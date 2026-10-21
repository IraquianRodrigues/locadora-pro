import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { runRegistryTests } from "./registry.mjs";
import { runReservationTests } from "./reservations.mjs";
import { runPublicTests } from "./public-booking.mjs";
import { runRentalTests } from "./rentals.mjs";
import { runBusinessTests } from "./business.mjs";
import { runProductionTests } from "./production.mjs";
import {
  users,
  sessions,
  seedFixtures,
  reservation,
  quote,
  rental,
} from "./support/fixtures.mjs";

export async function runDatabaseTests(db, connect) {
  const fixture = await seedFixtures(db);
  let passed = 0;
  const test = async (name, fn) => {
    await fn();
    passed++;
    console.log(`DB OK ${name}`);
  };
  const asUser = async (role, fn) => {
    const client = await connect();
    try {
      await client.query("begin");
      await client.query(
        role === "ANON"
          ? "set local role anon"
          : "set local role authenticated",
      );
      if (role !== "ANON")
        await client.query(
          "select set_config('request.jwt.claims',$1,true),set_config('request.jwt.claim.sub',$2,true)",
          [
            JSON.stringify({
              sub: users[role],
              role: "authenticated",
              session_id: sessions[role],
            }),
            users[role],
          ],
        );
      const result = await fn(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      await client.end();
    }
  };
  const errorCode = async (fn, code) =>
    assert.rejects(fn, (error) => {
      assert.equal(error.code, code, error.message);
      return true;
    });
  const key = () => randomUUID();
  const transaction = async (fn) => {
    await db.query("begin");
    try {
      const result = await fn();
      await db.query("commit");
      return result;
    } catch (error) {
      await db.query("rollback");
      throw error;
    }
  };

  await test("contexto próprio e permissões atuais por cargo; perfil inativo ou sem cargo negado", async () => {
    for (const role of ["ADMIN", "MANAGER", "ATTENDANT", "FINANCE"]) {
      const data = await asUser(
        role,
        async (c) =>
          (await c.query("select public.staff_context() as context")).rows[0]
            .context,
      );
      assert.equal(data.id, users[role]);
      assert.deepEqual(data.roles, [role]);
      assert.equal(data.sessionId, sessions[role]);
      assert.equal(data.permissions.includes("users.manage"), role === "ADMIN");
    }
    for (const role of ["REVOKED", "UNASSIGNED"])
      assert.equal(
        await asUser(
          role,
          async (c) =>
            (await c.query("select public.staff_context() as context")).rows[0]
              .context,
        ),
        null,
      );
  });
  await test("sessão ausente, expirada, alheia e inválida perde contexto e RLS", async () => {
    for (const id of [undefined, "invalid", randomUUID(), sessions.ADMIN]) {
      await asUser("ATTENDANT", async (c) => {
        await c.query("select set_config('request.jwt.claims',$1,true)", [
          JSON.stringify({ sub: users.ATTENDANT, session_id: id }),
        ]);
        const row = (
          await c.query(
            "select public.staff_context() as context, public.has_permission('customers.read') as allowed",
          )
        ).rows[0];
        assert.equal(row.context, null);
        assert.equal(row.allowed, false);
        assert.equal(
          (await c.query("select * from public.customers")).rowCount,
          0,
        );
        assert.equal(
          (await c.query("select * from public.profiles")).rowCount,
          0,
        );
      });
    }
    await db.query(
      "update auth.sessions set not_after=now()-interval '1 second' where id=$1",
      [sessions.ATTENDANT],
    );
    assert.equal(
      await asUser(
        "ATTENDANT",
        async (c) =>
          (
            await c.query(
              "select public.has_permission('customers.read') as allowed",
            )
          ).rows[0].allowed,
      ),
      false,
    );
    await db.query("delete from auth.sessions where id=$1", [
      sessions.ATTENDANT,
    ]);
    assert.equal(
      await asUser(
        "ATTENDANT",
        async (c) =>
          (await c.query("select public.staff_context() as context")).rows[0]
            .context,
      ),
      null,
    );
    await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
      sessions.ATTENDANT,
      users.ATTENDANT,
    ]);
  });
  await test("mudança de permissões vale na próxima consulta, sem renovar JWT", async () => {
    await db.query("begin");
    try {
      await db.query(
        "delete from public.role_permissions where role_id=(select id from public.roles where code='ATTENDANT') and permission_id=(select id from public.permissions where code='customers.write')",
      );
      // Mesma conexão/transação enxerga revogação ainda não confirmada.
      await db.query(
        "select set_config('request.jwt.claims',$1,true),set_config('request.jwt.claim.sub',$2,true)",
        [
          JSON.stringify({
            sub: users.ATTENDANT,
            session_id: sessions.ATTENDANT,
          }),
          users.ATTENDANT,
        ],
      );
      await db.query("set local role authenticated");
      assert.equal(
        (
          await db.query(
            "select public.has_permission('customers.write') as allowed",
          )
        ).rows[0].allowed,
        false,
      );
    } finally {
      await db.query("rollback");
    }
  });
  await test("limite Auth atômico e exclusivo de service_role", async () => {
    const hash = "a".repeat(64);
    const results = await Promise.all(
      Array.from({ length: 12 }, async () => {
        const c = await connect();
        try {
          await c.query("set role service_role");
          return (
            await c.query(
              "select public.consume_auth_limit($1,5,900) as allowed",
              [hash],
            )
          ).rows[0].allowed;
        } finally {
          await c.end();
        }
      }),
    );
    assert.equal(results.filter(Boolean).length, 5);
    for (const role of ["ANON", "ADMIN"])
      await errorCode(
        () =>
          asUser(role, (c) =>
            c.query("select public.consume_auth_limit($1,5,900)", [hash]),
          ),
        "42501",
      );
    await db.query(
      "update public.rate_limit_buckets set expires_at=now()-interval '1 second',window_start=now()-interval '901 seconds' where scope_key_hash=$1",
      [hash],
    );
    assert.equal(
      (
        await db.query(
          "select public.consume_auth_limit($1,5,900) as allowed",
          [hash],
        )
      ).rows[0].allowed,
      true,
    );
  });
  await test("auditoria Auth deriva ator e rejeita eventos livres", async () => {
    await asUser("ATTENDANT", (c) =>
      c.query("select public.record_auth_event('LOGIN')"),
    );
    const event = (
      await db.query("select * from public.audit_logs where action='LOGIN'")
    ).rows[0];
    assert.equal(event.actor_id, users.ATTENDANT);
    assert.deepEqual(event.safe_changes, {});
    await errorCode(
      () =>
        asUser("ADMIN", (c) =>
          c.query("select public.record_auth_event('arbitrary')"),
        ),
      "42501",
    );
    await errorCode(
      () =>
        asUser("REVOKED", (c) =>
          c.query("select public.record_auth_event('LOGIN')"),
        ),
      "42501",
    );
  });
  await test("todas as tabelas da aplicação têm RLS e anônimo sem grants", async () => {
    const rows = (
      await db.query(
        "select c.relname,c.relrowsecurity,has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') as anon_access from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'",
      )
    ).rows;
    const expected =
      `profiles roles permissions user_roles role_permissions branches company_settings system_settings
      vehicle_categories vehicles vehicle_images vehicle_documents vehicle_blocks vehicle_allocations
      customers drivers customer_documents customer_notes rate_plans rate_plan_prices pricing_rules additional_services
      quotes quote_items reservations reservation_items reservation_status_history reservation_locations
      rentals rental_drivers rental_extensions rental_locations rental_events rental_charge_cancellations contracts contract_templates
      inspections inspection_templates inspection_items inspection_photos damages
      charges payments payment_allocations payment_methods deposits refunds expenses maintenance_records charge_adjustments deposit_application_reversals expense_reversals maintenance_events vehicle_status_events
      notifications notification_templates notification_routes outbox_events audit_logs idempotency_keys rate_limit_buckets registry_files public_booking_operations public_reservation_submissions`
        .split(/\s+/)
        .sort();
    assert.deepEqual(rows.map((row) => row.relname).sort(), expected);
    for (const row of rows) {
      assert.equal(row.relrowsecurity, true, row.relname);
      assert.equal(row.anon_access, false, row.relname);
    }
  });
  await test("funções definer fixam search_path e não concedem execute a PUBLIC", async () => {
    const rows = (
      await db.query(`select p.proname,p.proconfig,exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') as public_execute
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.prosecdef`)
    ).rows;
    assert.ok(rows.length > 5);
    for (const row of rows) {
      assert.ok(
        row.proconfig.some((value) => value.startsWith("search_path=")),
        row.proname,
      );
      assert.equal(row.public_execute, false, row.proname);
    }
    for (const signature of [
      "app_private.secure_table(text,text,text)",
      "app_private.begin_operation(text,text,jsonb)",
      "app_private.finish_operation(text,text,jsonb)",
    ]) {
      const allowed = (
        await db.query(
          "select has_function_privilege('authenticated',$1,'EXECUTE') as allowed",
          [signature],
        )
      ).rows[0].allowed;
      assert.equal(allowed, false, signature);
    }
  });
  await test("catálogo anônimo omite placa, documentos e notas internas", async () => {
    const rows = await asUser(
      "ANON",
      async (c) =>
        (await c.query("select * from public.catalog_vehicles() ")).rows,
    );
    assert.equal(rows.length, 3);
    assert.equal(Object.hasOwn(rows[0], "plate"), false);
    assert.equal(Object.hasOwn(rows[0], "internal_notes"), false);
    await errorCode(
      () => asUser("ANON", (c) => c.query("select * from public.customers")),
      "42501",
    );
    await errorCode(
      () =>
        asUser("ANON", (c) =>
          c.query("select public.approve_reservation($1,$2)", [
            randomUUID(),
            key(),
          ]),
        ),
      "42501",
    );
  });
  await test("permissões ADMIN/MANAGER/ATTENDANT/FINANCE e revogação", async () => {
    for (const [role, permission, expected] of [
      ["ADMIN", "users.manage", true],
      ["MANAGER", "users.manage", false],
      ["ATTENDANT", "reservations.approve", false],
      ["ATTENDANT", "payments.confirm", false],
      ["FINANCE", "payments.confirm", true],
      ["FINANCE", "documents.read", false],
      ["REVOKED", "vehicles.read", false],
      ["UNASSIGNED", "vehicles.read", false],
    ]) {
      const allowed = await asUser(
        role,
        async (c) =>
          (
            await c.query("select public.has_permission($1) as allowed", [
              permission,
            ])
          ).rows[0].allowed,
      );
      assert.equal(allowed, expected, `${role} ${permission}`);
    }
    for (const role of ["REVOKED", "UNASSIGNED", "FINANCE"]) {
      assert.equal(
        await asUser(
          role,
          async (c) =>
            (await c.query("select * from public.vehicles")).rowCount,
        ),
        0,
      );
    }
    assert.equal(
      await asUser(
        "FINANCE",
        async (c) =>
          (await c.query("select * from public.finance_customers")).rowCount,
      ),
      1,
    );
    await errorCode(
      () =>
        asUser("ATTENDANT", (c) =>
          c.query("update public.profiles set active=true where id=$1", [
            users.ATTENDANT,
          ]),
        ),
      "42501",
    );
    await errorCode(
      () =>
        asUser("ATTENDANT", (c) =>
          c.query(
            "insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code='ADMIN'",
            [users.ATTENDANT],
          ),
        ),
      "42501",
    );
  });
  await test("CPF/CNPJ numérico e alfanumérico, valores, placa e tarifas inválidas", async () => {
    assert.equal(
      (
        await db.query(
          "select app_private.valid_cpf('52998224725') as cpf,app_private.valid_cpf('11111111111') as repeated,app_private.valid_cnpj('11222333000181') as cnpj,app_private.valid_cnpj('12ABC34501DE35') as alpha",
        )
      ).rows[0].alpha,
      true,
    );
    const invalid = (
      await db.query("select app_private.valid_cpf('11111111111') as value")
    ).rows[0].value;
    assert.equal(invalid, false);
    await errorCode(
      () =>
        db.query("update public.vehicles set mileage=-1 where id=$1", [
          fixture.vehicles[0],
        ]),
      "23514",
    );
    await errorCode(
      () =>
        db.query("update public.vehicles set plate='TST1A02' where id=$1", [
          fixture.vehicles[0],
        ]),
      "23505",
    );
    await errorCode(
      () =>
        db.query(
          "insert into public.rate_plans(name,period_unit,month_mode,policy) values('Inválido','MONTH','COMMERCIAL','{}')",
        ),
      "23514",
    );
    await errorCode(
      () =>
        db.query(
          "insert into public.charges(customer_id,kind,amount,due_at,description) values($1,'TEST','NaN','2030-01-01','teste')",
          [fixture.customer],
        ),
      "23514",
    );
  });
  await test("snapshot aprovado é imutável", async () => {
    const q = await quote(db, fixture);
    await errorCode(
      () => db.query("update public.quotes set total=1 where id=$1", [q]),
      "23514",
    );
    await errorCode(
      () =>
        db.query("update public.quote_items set total=1 where quote_id=$1", [
          q,
        ]),
      "23514",
    );
  });
  await test("aprovação simultânea do mesmo veículo tem exatamente um vencedor", async () => {
    const first = await reservation(db, fixture);
    const second = await reservation(db, fixture);
    const results = await Promise.allSettled(
      [first, second].map((r) =>
        asUser("MANAGER", (c) =>
          c.query("select public.approve_reservation($1,$2)", [r.id, key()]),
        ),
      ),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      results.find((r) => r.status === "rejected").reason.code,
      "23P01",
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from public.vehicle_allocations where vehicle_id=$1 and released_at is null",
          [fixture.vehicles[0]],
        )
      ).rows[0].n,
      1,
    );
    const winner = results[0].status === "fulfilled" ? first : second;
    const status = (
      await db.query("select status from public.reservations where id=$1", [
        winner.id,
      ])
    ).rows[0].status;
    assert.equal(status, "CONFIRMED");
    await asUser("MANAGER", (c) =>
      c.query(
        "select public.transition_reservation($1,'CANCELLED','Teste de liberação',$2)",
        [winner.id, key()],
      ),
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.vehicle_allocations where reservation_id=$1 and released_at is null",
          [winner.id],
        )
      ).rows[0].n,
      0,
    );
  });
  await test("aprovação por categoria respeita capacidade e idempotência", async () => {
    const requests = [];
    for (let i = 0; i < 4; i++)
      requests.push(
        await reservation(db, fixture, {
          category: fixture.category,
          start: "2030-02-01T00:00:00Z",
          end: "2030-02-03T00:00:00Z",
        }),
      );
    const keys = requests.map(key);
    const results = await Promise.allSettled(
      requests.map((r, i) =>
        asUser("MANAGER", (c) =>
          c.query("select public.approve_reservation($1,$2)", [r.id, keys[i]]),
        ),
      ),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 3);
    const index = results.findIndex((r) => r.status === "fulfilled");
    const again = await asUser("MANAGER", (c) =>
      c.query("select public.approve_reservation($1,$2)", [
        requests[index].id,
        keys[index],
      ]),
    );
    assert.deepEqual(again.rows, results[index].value.rows);
    await errorCode(
      () =>
        asUser("MANAGER", (c) =>
          c.query("select public.approve_reservation($1,$2)", [
            requests[(index + 1) % 4].id,
            keys[index],
          ]),
        ),
      "23505",
    );
  });
  await test("bloqueios e manutenção usam a mesma exclusão; intervalos adjacentes passam", async () => {
    const vehicle = fixture.vehicles[1];
    await asUser("MANAGER", (c) =>
      c.query(
        "select public.create_vehicle_block($1,'2030-04-01T00:00:00Z','2030-04-03T00:00:00Z','Teste',$2)",
        [vehicle, key()],
      ),
    );
    await errorCode(
      () =>
        asUser("MANAGER", (c) =>
          c.query(
            "select public.create_vehicle_block($1,'2030-04-02T00:00:00Z','2030-04-04T00:00:00Z','Teste',$2)",
            [vehicle, key()],
          ),
        ),
      "23P01",
    );
    await asUser("MANAGER", (c) =>
      c.query(
        "select public.create_vehicle_block($1,'2030-04-03T00:00:00Z','2030-04-04T00:00:00Z','Adjacente',$2)",
        [vehicle, key()],
      ),
    );
    await errorCode(
      () =>
        db.query(
          "insert into public.maintenance_records(vehicle_id,kind,mileage,start_at,end_at,description,responsible_id) values($1,'OIL',0,'2030-05-01T00:00:00Z','2030-05-02T00:00:00Z','Teste',$2)",
          [vehicle, users.MANAGER],
        ),
      "23514",
    );
    await errorCode(
      () =>
        transaction(async () => {
          const maintenance = (
            await db.query(
              "insert into public.maintenance_records(vehicle_id,kind,mileage,start_at,end_at,description,responsible_id) values($1,'OIL',0,'2030-04-02T00:00Z','2030-04-04T00:00Z','Teste',$2) returning id",
              [vehicle, users.MANAGER],
            )
          ).rows[0].id;
          await db.query(
            "insert into public.vehicle_allocations(vehicle_id,period,kind,maintenance_record_id,created_by) values($1,tstzrange('2030-04-02T00:00Z','2030-04-04T00:00Z','[)'),'MAINTENANCE',$2,$3)",
            [vehicle, maintenance, users.MANAGER],
          );
        }),
      "23P01",
    );
  });
  await test("status arbitrário ou confirmação sem alocação são recusados", async () => {
    const r = await reservation(db, fixture, {
      start: "2030-06-01T00:00:00Z",
      end: "2030-06-02T00:00:00Z",
    });
    await errorCode(
      () =>
        db.query(
          "update public.reservations set status='CONVERTED' where id=$1",
          [r.id],
        ),
      "23514",
    );
    await errorCode(
      () =>
        db.query(
          "update public.reservations set status='CONFIRMED' where id=$1",
          [r.id],
        ),
      "23514",
    );
    await errorCode(
      () =>
        asUser("ATTENDANT", (c) =>
          c.query("select public.approve_reservation($1,$2)", [r.id, key()]),
        ),
      "42501",
    );
  });
  await test("prorrogação conflitante desfaz datas, aditivo e outbox", async () => {
    const r = await rental(db, fixture);
    await asUser("MANAGER", (c) =>
      c.query(
        "select public.create_vehicle_block($1,'2030-03-04T12:00Z','2030-03-06T12:00Z','Teste',$2)",
        [fixture.vehicles[2], key()],
      ),
    );
    const conflict = await quote(db, fixture, r.end, "2030-03-05T12:00Z");
    await errorCode(
      () =>
        asUser("MANAGER", (c) =>
          c.query("select public.extend_rental($1,$2,$3)", [
            r.id,
            conflict,
            key(),
          ]),
        ),
      "23P01",
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.rental_extensions where rental_id=$1",
          [r.id],
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await db.query("select end_at from public.rentals where id=$1", [r.id])
      ).rows[0].end_at.toISOString(),
      new Date(r.end).toISOString(),
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.outbox_events where event_type='rental.extended' and payload->>'rental_id'=$1",
          [r.id],
        )
      ).rows[0].n,
      0,
    );
    const valid = await quote(db, fixture, r.end, "2030-03-04T12:00Z");
    await asUser("MANAGER", (c) =>
      c.query("select public.extend_rental($1,$2,$3)", [r.id, valid, key()]),
    );
  });
  await test("pagamento exige confirmação, é idempotente e protege saldo concorrente", async () => {
    const charge = (
      await db.query(
        "insert into public.charges(customer_id,kind,amount,due_at,description) values($1,'RENTAL',100,'2030-01-01','Teste') returning id",
        [fixture.customer],
      )
    ).rows[0].id;
    await errorCode(
      () =>
        asUser("FINANCE", (c) =>
          c.query("select public.confirm_charge_payment($1,$2,60,false,$3)", [
            charge,
            fixture.method,
            key(),
          ]),
        ),
      "22023",
    );
    const keys = [key(), key()];
    const results = await Promise.allSettled(
      keys.map((k) =>
        asUser("FINANCE", (c) =>
          c.query("select public.confirm_charge_payment($1,$2,60,true,$3)", [
            charge,
            fixture.method,
            k,
          ]),
        ),
      ),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      results.find((r) => r.status === "rejected").reason.code,
      "23514",
    );
    const index = results.findIndex((r) => r.status === "fulfilled");
    const again = await asUser("FINANCE", (c) =>
      c.query("select public.confirm_charge_payment($1,$2,60,true,$3)", [
        charge,
        fixture.method,
        keys[index],
      ]),
    );
    assert.deepEqual(again.rows, results[index].value.rows);
    assert.equal(
      (
        await asUser("FINANCE", (c) =>
          c.query(
            "select balance from public.finance_charge_balances where id=$1",
            [charge],
          ),
        )
      ).rows[0].balance,
      "40.00",
    );
    await errorCode(
      () => db.query("update public.payments set amount=1"),
      "23514",
    );
  });
  await test("reembolsos compensatórios e caução não ultrapassam saldo", async () => {
    const allocation = (
      await db.query("select * from public.payment_allocations limit 1")
    ).rows[0];
    await errorCode(
      () =>
        db.query(
          "insert into public.refunds(payment_id,payment_allocation_id,amount,reason,confirmed_by) values($1,$2,61,'Teste',$3)",
          [allocation.payment_id, allocation.id, users.FINANCE],
        ),
      "23514",
    );
    await db.query(
      "insert into public.refunds(payment_id,payment_allocation_id,amount,reason,confirmed_by) values($1,$2,20,'Teste',$3)",
      [allocation.payment_id, allocation.id, users.FINANCE],
    );
    assert.equal(
      (
        await asUser("FINANCE", (c) =>
          c.query(
            "select balance from public.finance_charge_balances where id=$1",
            [allocation.charge_id],
          ),
        )
      ).rows[0].balance,
      "60.00",
    );
    const r = await rental(db, fixture, {
      start: "2030-07-01T00:00Z",
      end: "2030-07-03T00:00Z",
    });
    const charge = (
      await db.query(
        "insert into public.charges(customer_id,rental_id,kind,amount,due_at,description) values($1,$2,'TEST',100,'2030-07-01','Teste') returning id",
        [fixture.customer, r.id],
      )
    ).rows[0].id;
    const deposit = (
      await db.query(
        "insert into public.deposits(rental_id,payment_method_id,amount,kind,confirmed_by) values($1,$2,100,'RECEIVED',$3) returning id",
        [r.id, fixture.method, users.FINANCE],
      )
    ).rows[0].id;
    await db.query(
      "insert into public.deposits(rental_id,applied_charge_id,amount,kind,original_deposit_id,confirmed_by) values($1,$2,60,'APPLIED',$3,$4)",
      [r.id, charge, deposit, users.FINANCE],
    );
    await errorCode(
      () =>
        db.query(
          "insert into public.refunds(deposit_id,amount,reason,confirmed_by) values($1,41,'Teste',$2)",
          [deposit, users.FINANCE],
        ),
      "23514",
    );
    await db.query(
      "insert into public.refunds(deposit_id,amount,reason,confirmed_by) values($1,40,'Teste',$2)",
      [deposit, users.FINANCE],
    );
  });
  await test("vistorias concluídas preservam itens e evidências", async () => {
    const r = await rental(db, fixture, {
      vehicle: fixture.vehicles[0],
      start: "2030-08-01T00:00Z",
      end: "2030-08-03T00:00Z",
    });
    const template = (
      await db.query(
        "insert into public.inspection_templates(name,version,checklist) values('Teste',1,'[]') returning id",
      )
    ).rows[0].id;
    const inspection = (
      await db.query(
        "insert into public.inspections(rental_id,template_id,inspector_id,kind,mileage,fuel,checklist_snapshot) values($1,$2,$3,'INITIAL',0,100,'[]') returning id",
        [r.id, template, users.ATTENDANT],
      )
    ).rows[0].id;
    await db.query(
      "insert into public.inspection_items(inspection_id,item_key,condition) values($1,'BODY','OK')",
      [inspection],
    );
    await db.query(
      "update public.inspections set completed_at=clock_timestamp() where id=$1",
      [inspection],
    );
    await errorCode(
      () =>
        db.query(
          "update public.inspection_items set condition='DAMAGE' where inspection_id=$1",
          [inspection],
        ),
      "23514",
    );
    await errorCode(
      () =>
        db.query(
          "insert into public.inspection_photos(inspection_id,storage_path,sha256) values($1,$2,$3)",
          [inspection, `${inspection}/${randomUUID()}.jpg`, "a".repeat(64)],
        ),
      "23514",
    );
  });
  await runRegistryTests({ db, asUser, test, errorCode, fixture });
  await runReservationTests({ db, connect, asUser, test, errorCode, fixture });
  await runPublicTests({ db, connect, asUser, test, errorCode, fixture });
  await runRentalTests({ db, connect, asUser, test, errorCode, fixture });
  await runBusinessTests({ db, connect, asUser, test, errorCode, fixture });
  await runProductionTests({ db, connect, asUser, test, errorCode, fixture });
  await test("seed de desenvolvimento exige configuração explícita", async () => {
    const sql = await readFile("supabase/seeds/development.sql", "utf8");
    await errorCode(() => db.query(sql), "P0001");
    await transaction(async () => {
      await db.query("select set_config('app.environment','development',true)");
      await db.query(sql);
    });
  });
  await test("último administrador é preservado e revogação é imediata", async () => {
    await errorCode(
      () =>
        asUser("ADMIN", (c) =>
          c.query("select public.set_staff_access($1,false,'ATTENDANT')", [
            users.ADMIN,
          ]),
        ),
      "23514",
    );
    await asUser("ADMIN", (c) =>
      c.query("select public.set_staff_access($1,false,'MANAGER')", [
        users.MANAGER,
      ]),
    );
    await errorCode(
      () =>
        asUser("MANAGER", (c) =>
          c.query(
            "select public.create_vehicle_block($1,'2031-01-01T00:00:00Z','2031-01-02T00:00:00Z','Revogado',$2)",
            [fixture.vehicles[0], key()],
          ),
        ),
      "42501",
    );
  });
  await test("storage exige permissão e metadado; buckets privados e auditoria append-only", async () => {
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from storage.buckets where public=false",
        )
      ).rows[0].n,
      4,
    );
    const storagePath = `${fixture.vehicles[0]}/${randomUUID()}.jpg`;
    await db.query(
      "insert into public.vehicle_images(vehicle_id,storage_path,alt_text) values($1,$2,'Foto teste')",
      [fixture.vehicles[0], storagePath],
    );
    await errorCode(
      () =>
        asUser("ADMIN", (c) =>
          c.query(
            "insert into storage.objects(bucket_id,name) values('vehicle-images',$1)",
            [storagePath],
          ),
        ),
      "42501",
    );
    // Uploads dos cadastros agora só entram pelo servidor após validação de conteúdo.
    await db.query(
      "insert into storage.objects(bucket_id,name) values('vehicle-images',$1)",
      [storagePath],
    );
    await errorCode(
      () =>
        asUser("FINANCE", (c) =>
          c.query(
            "insert into storage.objects(bucket_id,name) values('vehicle-images',$1)",
            [storagePath.replace(".jpg", ".png")],
          ),
        ),
      "42501",
    );
    assert.equal(
      (await asUser("FINANCE", (c) => c.query("select * from storage.objects")))
        .rowCount,
      0,
    );
    await errorCode(() => db.query("delete from public.audit_logs"), "23514");
    const safe = (
      await db.query("select safe_changes from public.audit_logs limit 1")
    ).rows[0].safe_changes;
    assert.deepEqual(Object.keys(safe), ["operation"]);
  });
  return { passed };
}
