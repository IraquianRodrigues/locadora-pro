import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { users, rental as legacyRental } from "./support/fixtures.mjs";

export async function runRentalTests({
  db,
  connect,
  asUser,
  test,
  errorCode,
  fixture,
}) {
  const samples = JSON.parse(
    await readFile("tests/fixtures/pricing.json", "utf8"),
  );
  const rpc = async (role, name, input, key = randomUUID()) =>
    (
      await asUser(role, (c) =>
        c.query(`select public.${name}($1,$2) result`, [input, key]),
      )
    ).rows[0].result;
  const service = async (name, args) => {
    const c = await connect();
    try {
      await c.query("begin");
      await c.query("set local role service_role");
      const r = await c.query(
        `select * from public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")})`,
        args,
      );
      await c.query("commit");
      return r.rows;
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      await c.end();
    }
  };
  const row = async (id) =>
    (await db.query("select * from public.rentals where id=$1", [id])).rows[0];
  const cmd = async (
    id,
    action,
    patch = {},
    key = randomUUID(),
    role = "ATTENDANT",
  ) =>
    rpc(
      role,
      "rental_command",
      {
        rental_id: id,
        expected_version: (await row(id)).version,
        action,
        ...patch,
      },
      key,
    );
  let category,
    vehicle,
    driver,
    inspectionTemplate,
    contractTemplate,
    policy,
    main,
    quoteId,
    initial,
    contractJob,
    final;
  const now = Date.now(),
    start = new Date(now - 3600000).toISOString(),
    end = new Date(now + 86400000).toISOString();
  async function q(v, startAt = start, endAt = end, patch = {}, deposit = 500) {
    const input = {
      ...samples.input,
      branch_id: fixture.branch,
      vehicle_id: v,
      category_id: null,
      customer_id: fixture.customer,
      start_at: startAt,
      end_at: endAt,
      ...patch,
    };
    const snapshot = {
      engine: "v1",
      input,
      policy: { ...samples.policy, deposit_amount: deposit.toFixed(2) },
      calculation: {
        total: "100.00",
        deposit: deposit.toFixed(2),
        lines: [
          {
            kind: "RENTAL",
            description: "Teste F7",
            quantity: "1.0000",
            unit_amount: "100.00",
            total: "100.00",
          },
        ],
      },
    };
    const id = (
      await db.query(
        "insert into public.quotes(customer_id,rate_plan_id,start_at,end_at,expires_at,total,deposit,rules_snapshot) values($1,$2,$3,$4,now()+interval '2 days',100,$6,$5) returning id",
        [fixture.customer, fixture.plan, startAt, endAt, snapshot, deposit],
      )
    ).rows[0].id;
    await db.query(
      "insert into public.quote_items(quote_id,kind,description,quantity,unit_amount,total,snapshot) values($1,'RENTAL','Teste F7',1,100,100,'{}')",
      [id],
    );
    await db.query("update public.quotes set locked_at=now() where id=$1", [
      id,
    ]);
    return id;
  }
  async function newVehicle(plate) {
    return (
      await db.query(
        "insert into public.vehicles(category_id,branch_id,plate,make,model,manufacture_year,model_year,color,fuel,transmission,passengers,doors) values($1,$2,$3,'Teste','Fase 7',2025,2025,'Branco','FLEX','MANUAL',5,4) returning id",
        [category, fixture.branch, plate],
      )
    ).rows[0].id;
  }
  await test("F7 configuração exige ADMIN, revisão jurídica e escolhas operacionais explícitas", async () => {
    category = (
      await db.query(
        "insert into public.vehicle_categories(name,capacity) values('Fase 7 SQL',5) returning id",
      )
    ).rows[0].id;
    vehicle = await newVehicle("FSX7A01");
    quoteId = await q(vehicle);
    await errorCode(
      () =>
        rpc("ATTENDANT", "create_rental", {
          quote_id: quoteId,
          vehicle_id: vehicle,
        }),
      "23514",
    );
    await errorCode(
      () => rpc("MANAGER", "rental_setup", { kind: "POLICY", policy: {} }),
      "42501",
    );
    inspectionTemplate = (
      await rpc("ADMIN", "rental_setup", {
        kind: "INSPECTION_TEMPLATE",
        name: "Checklist F7",
        version: 1,
        checklist: [{ key: "body", label: "Lataria", photo_required: false }],
      })
    ).id;
    await errorCode(
      () =>
        rpc("ADMIN", "rental_setup", {
          kind: "CONTRACT_TEMPLATE",
          name: "Teste F7",
          version: 1,
          body: "Texto fictício exclusivamente para teste automatizado.",
          review_status: "APPROVED",
          legal_review_confirmed: false,
        }),
      "23514",
    );
    contractTemplate = (
      await rpc("ADMIN", "rental_setup", {
        kind: "CONTRACT_TEMPLATE",
        name: "Teste F7",
        version: 1,
        body: "Texto fictício exclusivamente para teste automatizado.",
        review_status: "APPROVED",
        legal_review_confirmed: true,
      })
    ).id;
    policy = {
      version: 1,
      checkout_payment: "FULL",
      checkin_balance: "SETTLED",
      require_deposit: true,
      require_documents: false,
      license_categories: ["B"],
      inspection_template_id: inspectionTemplate,
      contract_template_id: contractTemplate,
      included_km_per_day: 100,
      late_tolerance_minutes: 30,
      extra_km_amount: "1.00",
      fuel_percent_amount: "2.00",
      late_hour_amount: "10.00",
    };
    await rpc("ADMIN", "rental_setup", {
      kind: "POLICY",
      policy,
      expected_updated_at: null,
    });
    await rpc("ADMIN", "rental_setup", {
      kind: "COMPANY",
      legal_name: "Empresa Fictícia F7",
      tax_document: "11222333000181",
      timezone: "America/Fortaleza",
      expected_updated_at: null,
      contact: {
        email: "company@example.invalid",
        phone: "85999999998",
        address: {
          postal_code: "60000000",
          street: "Rua de teste",
          number: "1",
          district: "Centro",
          city: "Fortaleza",
          state: "CE",
        },
      },
    });
    await errorCode(
      () =>
        rpc("ADMIN", "rental_setup", {
          kind: "POLICY",
          policy,
          expected_updated_at: null,
        }),
      "40001",
    );
    await errorCode(
      () =>
        db.query(
          "update public.contract_templates set body='Rewrite' where id=$1",
          [contractTemplate],
        ),
      "23514",
    );
  });
  await test("F7 locação direta cria obrigação sem presumir pagamento; replay não duplica ocupação", async () => {
    const input = { quote_id: quoteId, vehicle_id: vehicle },
      key = randomUUID();
    main = (await rpc("ATTENDANT", "create_rental", input, key)).id;
    assert.equal(
      (await rpc("ATTENDANT", "create_rental", input, key)).id,
      main,
    );
    assert.equal((await row(main)).status, "PREPARING");
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.vehicle_allocations where rental_id=$1 and released_at is null",
          [main],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.charges where rental_id=$1",
          [main],
        )
      ).rows[0].n,
      1,
    );
    await errorCode(() => rpc("ATTENDANT", "create_rental", input), "23505");
    await errorCode(
      () =>
        rpc("FINANCE", "rental_command", {
          rental_id: main,
          expected_version: 1,
          action: "CHECKOUT",
        }),
      "42501",
    );
    assert.equal(
      (
        await asUser("FINANCE", (c) =>
          c.query("select * from public.rentals where id=$1", [main]),
        )
      ).rowCount,
      0,
    );
  });
  await test("F7 retirada incompleta, condutor alheio e versão obsoleta são recusados", async () => {
    await errorCode(() => cmd(main, "CHECKOUT"), "23514");
    await errorCode(
      () => cmd(main, "DRIVERS", { driver_ids: [randomUUID()] }),
      "23514",
    );
    const current = await row(main);
    driver = (
      await db.query(
        "insert into public.drivers(customer_id,name,cpf,license_number,license_category,license_expires_on) values($1,'Condutor F7','39053344705','98765432109','B','2040-12-31') returning id",
        [fixture.customer],
      )
    ).rows[0].id;
    await cmd(main, "DRIVERS", { driver_ids: [driver] });
    await errorCode(
      () =>
        rpc("ATTENDANT", "rental_command", {
          rental_id: main,
          expected_version: current.version,
          action: "CONTRACT",
        }),
      "40001",
    );
  });
  await test("F7 checklist completo e foto de avaria são obrigatórios; upload direto é bloqueado", async () => {
    initial = (
      await cmd(main, "INSPECTION", {
        kind: "INITIAL",
        mileage: 1000,
        fuel: 100,
        notes: "Inicial",
      })
    ).inspection_id;
    await errorCode(
      () => cmd(main, "COMPLETE_INSPECTION", { inspection_id: initial }),
      "23514",
    );
    await cmd(main, "ITEMS", {
      inspection_id: initial,
      items: [
        {
          key: "body",
          condition: "DAMAGE",
          notes: "Risco pré-existente no para-choque",
        },
      ],
    });
    await errorCode(
      () => cmd(main, "COMPLETE_INSPECTION", { inspection_id: initial }),
      "23514",
    );
    const item = (
      await db.query(
        "select id from public.inspection_items where inspection_id=$1",
        [initial],
      )
    ).rows[0].id;
    const ph = (
      await asUser("ATTENDANT", (c) =>
        c.query("select public.prepare_inspection_photo($1) result", [
          {
            inspection_id: initial,
            item_id: item,
            sha256: "a".repeat(64),
            byte_size: 1000,
          },
        ]),
      )
    ).rows[0].result;
    await errorCode(
      () =>
        asUser("ATTENDANT", (c) =>
          c.query(
            "insert into storage.objects(bucket_id,name) values('inspections',$1)",
            [ph.storage_path],
          ),
        ),
      "42501",
    );
    await errorCode(
      () =>
        asUser("ATTENDANT", (c) =>
          c.query("select public.finish_inspection_photo($1,true)", [ph.id]),
        ),
      "23514",
    );
    await db.query(
      "insert into storage.objects(bucket_id,name) values('inspections',$1)",
      [ph.storage_path],
    );
    assert.equal(
      (
        await asUser("ATTENDANT", (c) =>
          c.query("select * from storage.objects where name=$1", [
            ph.storage_path,
          ]),
        )
      ).rowCount,
      0,
    );
    await asUser("ATTENDANT", (c) =>
      c.query("select public.finish_inspection_photo($1,true)", [ph.id]),
    );
    await cmd(main, "COMPLETE_INSPECTION", { inspection_id: initial });
    assert.equal(
      (
        await asUser("ATTENDANT", (c) =>
          c.query("select * from storage.objects where name=$1", [
            ph.storage_path,
          ]),
        )
      ).rowCount,
      1,
    );
    await errorCode(
      () =>
        db.query("update public.inspection_photos set sha256=$2 where id=$1", [
          ph.id,
          "b".repeat(64),
        ]),
      "23514",
    );
    await errorCode(
      () =>
        db.query("update public.inspections set mileage=1 where id=$1", [
          initial,
        ]),
      "23514",
    );
  });
  await test("F7 contrato usa snapshot imutável, lease exclusivo e publicação condicionada a objeto privado", async () => {
    const result = await cmd(main, "CONTRACT");
    assert.ok(result.contract_id);
    await errorCode(
      () =>
        asUser("ATTENDANT", (c) =>
          c.query("select * from public.claim_contract_jobs(1)"),
        ),
      "42501",
    );
    const claims = await Promise.all([
      service("claim_contract_jobs", [1]),
      service("claim_contract_jobs", [1]),
    ]);
    assert.equal(claims.flat().length, 1);
    contractJob = claims.flat()[0];
    assert.equal(contractJob.rental_id, main);
    assert.equal(
      contractJob.snapshot.customer.name,
      "Cliente exclusivamente de teste",
    );
    await errorCode(
      () =>
        db.query("update public.contracts set snapshot='{}' where id=$1", [
          contractJob.id,
        ]),
      "23514",
    );
    const path = `${main}/${contractJob.lease_token}.pdf`;
    assert.equal(
      (
        await service("finish_contract_job", [
          contractJob.id,
          randomUUID(),
          path,
          "c".repeat(64),
        ])
      )[0].finish_contract_job,
      false,
    );
    await errorCode(
      () =>
        service("finish_contract_job", [
          contractJob.id,
          contractJob.lease_token,
          path,
          "c".repeat(64),
        ]),
      "23514",
    );
    await db.query(
      "insert into storage.objects(bucket_id,name) values('contracts',$1)",
      [path],
    );
    assert.equal(
      (
        await service("finish_contract_job", [
          contractJob.id,
          contractJob.lease_token,
          path,
          "c".repeat(64),
        ])
      )[0].finish_contract_job,
      true,
    );
    await errorCode(
      () =>
        db.query("update public.contracts set attempts=0 where id=$1", [
          contractJob.id,
        ]),
      "23514",
    );
    assert.equal(
      (
        await asUser("FINANCE", (c) =>
          c.query("select * from storage.objects where name=$1", [path]),
        )
      ).rowCount,
      0,
    );
  });
  await test("F7 retirada exige logística, recebimento real e caução; concorrência tem um vencedor", async () => {
    await errorCode(() => cmd(main, "CHECKOUT"), "23514");
    await cmd(main, "LOGISTICS", {
      direction: "PICKUP",
      notes: "Entrega executada e conferida",
    });
    await errorCode(() => cmd(main, "CHECKOUT"), "23514");
    const charge = (
      await db.query("select id from public.charges where rental_id=$1", [main])
    ).rows[0].id;
    await asUser("FINANCE", (c) =>
      c.query("select public.confirm_charge_payment($1,$2,100,true,$3)", [
        charge,
        fixture.method,
        randomUUID(),
      ]),
    );
    await errorCode(() => cmd(main, "CHECKOUT"), "23514");
    await db.query(
      "insert into public.deposits(rental_id,payment_method_id,amount,kind,confirmed_by) values($1,$2,500,'RECEIVED',$3)",
      [main, fixture.method, users.FINANCE],
    );
    const current = await row(main),
      input = {
        rental_id: main,
        expected_version: current.version,
        action: "CHECKOUT",
      };
    const results = await Promise.allSettled([
      rpc("ATTENDANT", "rental_command", input),
      rpc("ATTENDANT", "rental_command", input),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal((await row(main)).status, "ACTIVE");
  });
  await test("F7 prorrogação conflitante desfaz preço, obrigação e aditivo PDF", async () => {
    const original = await row(main),
      newEnd = new Date(original.end_at.getTime() + 86400000).toISOString();
    const eq = await q(vehicle, original.end_at, newEnd, {}, 0);
    // Plano de prorrogação não reapresenta caução; política original permanece no contrato.
    await asUser("MANAGER", (c) =>
      c.query(
        "select public.create_vehicle_block($1,$2,$3,'Conflito teste',$4)",
        [
          vehicle,
          new Date(original.end_at.getTime() + 3600000).toISOString(),
          newEnd,
          randomUUID(),
        ],
      ),
    );
    const counts = (
      await db.query(
        "select (select count(*) from public.contracts where rental_id=$1)::int contracts,(select count(*) from public.charges where rental_id=$1)::int charges",
        [main],
      )
    ).rows[0];
    await errorCode(
      () =>
        asUser("MANAGER", (c) =>
          c.query("select public.extend_rental($1,$2,$3)", [
            main,
            eq,
            randomUUID(),
          ]),
        ),
      "23P01",
    );
    assert.equal(
      (await row(main)).end_at.toISOString(),
      original.end_at.toISOString(),
    );
    assert.deepEqual(
      (
        await db.query(
          "select (select count(*) from public.contracts where rental_id=$1)::int contracts,(select count(*) from public.charges where rental_id=$1)::int charges",
          [main],
        )
      ).rows[0],
      counts,
    );
  });
  await test("F7 prorrogação válida é idempotente e cria aditivo e obrigação uma vez", async () => {
    await db.query("begin");
    try {
      await db.query(
        "update public.vehicle_allocations set released_at=now() where vehicle_id=$1 and kind='BLOCK' and released_at is null",
        [vehicle],
      );
      await db.query(
        "update public.vehicle_blocks set active=false where vehicle_id=$1",
        [vehicle],
      );
      await db.query("commit");
    } catch (e) {
      await db.query("rollback");
      throw e;
    }
    const original = await row(main),
      newEnd = new Date(original.end_at.getTime() + 86400000).toISOString(),
      qid = await q(vehicle, original.end_at, newEnd, {}, 0),
      key = randomUUID();
    const extend = () =>
      asUser("MANAGER", (c) =>
        c.query("select public.extend_rental($1,$2,$3) result", [
          main,
          qid,
          key,
        ]),
      );
    const first = (await extend()).rows[0].result;
    assert.ok(first.contract_id);
    const extended = await row(main);
    assert.equal(extended.commercial_snapshot.extensions[0].quote.engine, "v1");
    assert.equal(
      new Date(extended.commercial_snapshot.extensions[0].end_at).toISOString(),
      newEnd,
    );
    assert.deepEqual((await extend()).rows[0].result, first);
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.rental_extensions where rental_id=$1",
          [main],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.charges where rental_id=$1 and kind='EXTENSION'",
          [main],
        )
      ).rows[0].n,
      1,
    );
    // Quitação da prorrogação pelo financeiro, sem alterar a caução original.
    const charge = (
      await db.query(
        "select id from public.charges where rental_id=$1 and kind='EXTENSION'",
        [main],
      )
    ).rows[0].id;
    await asUser("FINANCE", (c) =>
      c.query("select public.confirm_charge_payment($1,$2,100,true,$3)", [
        charge,
        fixture.method,
        randomUUID(),
      ]),
    );
  });
  await test("F7 devolução apura extras uma vez, aguarda pagamento e preserva alocação", async () => {
    final = (
      await cmd(main, "INSPECTION", {
        kind: "FINAL",
        mileage: 1400,
        fuel: 90,
        notes: "Final",
      })
    ).inspection_id;
    await cmd(main, "ITEMS", {
      inspection_id: final,
      items: [
        {
          key: "body",
          condition: "DAMAGE",
          notes: "Risco já registrado na vistoria inicial",
        },
      ],
    });
    const item = (
      await db.query(
        "select id from public.inspection_items where inspection_id=$1",
        [final],
      )
    ).rows[0].id;
    const ph = (
      await asUser("ATTENDANT", (c) =>
        c.query("select public.prepare_inspection_photo($1) result", [
          {
            inspection_id: final,
            item_id: item,
            sha256: "d".repeat(64),
            byte_size: 1000,
          },
        ]),
      )
    ).rows[0].result;
    await db.query(
      "insert into storage.objects(bucket_id,name) values('inspections',$1)",
      [ph.storage_path],
    );
    await asUser("ATTENDANT", (c) =>
      c.query("select public.finish_inspection_photo($1,true)", [ph.id]),
    );
    await cmd(main, "COMPLETE_INSPECTION", { inspection_id: final });
    await cmd(main, "LOGISTICS", {
      direction: "RETURN",
      notes: "Recebido na unidade e conferido",
    });
    await errorCode(() => cmd(main, "CHECKIN"), "23514");
    const damage = (
      await db.query("select id from public.damages where inspection_id=$1", [
        final,
      ])
    ).rows[0].id;
    await errorCode(
      () =>
        cmd(main, "ASSESS_DAMAGE", {
          damage_id: damage,
          amount: "0.00",
          reason: "Sem novo dano: avaria pré-existente",
        }),
      "42501",
    );
    await cmd(
      main,
      "ASSESS_DAMAGE",
      {
        damage_id: damage,
        amount: "0.00",
        reason: "Sem novo dano: avaria pré-existente",
      },
      randomUUID(),
      "MANAGER",
    );
    assert.equal(
      (
        await db.query("select status from public.damages where id=$1", [
          damage,
        ])
      ).rows[0].status,
      "RESOLVED",
    );
    const result = await cmd(main, "CHECKIN");
    assert.equal(result.awaiting_payment, true);
    assert.equal((await row(main)).status, "ACTIVE");
    // Após a prorrogação: 3 diárias de km, 100 excedentes + 10 pontos de combustível.
    const charge = (
      await db.query(
        "select * from public.charges where rental_id=$1 and kind='RETURN_EXTRAS'",
        [main],
      )
    ).rows[0];
    assert.equal(charge.amount, "120.00");
    await cmd(main, "CHECKIN");
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.charges where rental_id=$1 and kind='RETURN_EXTRAS'",
          [main],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.vehicle_allocations where rental_id=$1 and released_at is null",
          [main],
        )
      ).rows[0].n,
      1,
    );
    await asUser("FINANCE", (c) =>
      c.query("select public.confirm_charge_payment($1,$2,120,true,$3)", [
        charge.id,
        fixture.method,
        randomUUID(),
      ]),
    );
    await cmd(main, "CHECKIN");
    assert.equal((await row(main)).status, "COMPLETED");
    assert.equal(
      (
        await db.query("select mileage from public.vehicles where id=$1", [
          vehicle,
        ])
      ).rows[0].mileage,
      "1400",
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.vehicle_allocations where rental_id=$1 and released_at is null",
          [main],
        )
      ).rows[0].n,
      0,
    );
  });
  await test("F7 conversão transfere a mesma alocação e cancelamento compensa obrigação não recebida", async () => {
    const v = await newVehicle("FSX7A02"),
      qid = await q(
        v,
        new Date(now + 3 * 86400000).toISOString(),
        new Date(now + 4 * 86400000).toISOString(),
      );
    await db.query("begin");
    const rid = (
      await db.query(
        "insert into public.reservations(customer_id,branch_id,quote_id,start_at,end_at,lookup_token_hash,lookup_expires_at,expires_at) select customer_id,$2,id,start_at,end_at,$3,now()+interval '10 days',now()+interval '1 day' from public.quotes where id=$1 returning id",
        [qid, fixture.branch, randomUUID().replaceAll("-", "").repeat(2)],
      )
    ).rows[0].id;
    await db.query(
      "insert into public.reservation_items(reservation_id,vehicle_id) values($1,$2)",
      [rid, v],
    );
    await db.query(
      "insert into public.reservation_locations(reservation_id,branch_id,direction,mode,address_snapshot,fee,scheduled_at) select $1,$2,d,'BRANCH',address,0,now() from public.branches cross join unnest(array['PICKUP','RETURN']) d where id=$2",
      [rid, fixture.branch],
    );
    await db.query("commit");
    await asUser("MANAGER", (c) =>
      c.query("select public.approve_reservation($1,$2)", [rid, randomUUID()]),
    );
    const a = (
        await db.query(
          "select id from public.vehicle_allocations where reservation_id=$1",
          [rid],
        )
      ).rows[0].id,
      version = (
        await db.query("select version from public.reservations where id=$1", [
          rid,
        ])
      ).rows[0].version;
    const converted = (
      await rpc("ATTENDANT", "create_rental", {
        reservation_id: rid,
        expected_version: version,
      })
    ).id;
    const allocation = (
      await db.query("select * from public.vehicle_allocations where id=$1", [
        a,
      ])
    ).rows[0];
    assert.equal(allocation.rental_id, converted);
    assert.equal(allocation.reservation_id, null);
    assert.equal(allocation.released_at, null);
    await errorCode(
      () =>
        rpc("ATTENDANT", "create_rental", {
          reservation_id: rid,
          expected_version: version,
        }),
      "40001",
    );
    await cmd(converted, "CANCEL", {
      reason: "Cliente desistiu antes da retirada",
    });
    const charge = (
      await db.query("select id from public.charges where rental_id=$1", [
        converted,
      ])
    ).rows[0].id;
    assert.equal(
      (
        await asUser("FINANCE", (c) =>
          c.query(
            "select balance from public.finance_charge_balances where id=$1",
            [charge],
          ),
        )
      ).rows[0].balance,
      "0",
    );
    await errorCode(
      () =>
        asUser("FINANCE", (c) =>
          c.query("select public.confirm_charge_payment($1,$2,100,true,$3)", [
            charge,
            fixture.method,
            randomUUID(),
          ]),
        ),
      "23514",
    );
  });
  await test("F7 atraso mantém ocupação, produz evento único e impede nova locação", async () => {
    const overdue = await legacyRental(db, fixture, {
      vehicle: fixture.vehicles[0],
      start: new Date(now - 3 * 86400000).toISOString(),
      end: new Date(now - 2 * 86400000).toISOString(),
    });
    await db.query(
      "update public.rentals set status='ACTIVE',actual_start_at=start_at,initial_mileage=0,initial_fuel=100 where id=$1",
      [overdue.id],
    );
    await service("mark_overdue_rentals", [100]);
    await service("mark_overdue_rentals", [100]);
    assert.equal((await row(overdue.id)).status, "OVERDUE");
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.outbox_events where event_type='rental.overdue' and payload->>'rental_id'=$1",
          [overdue.id],
        )
      ).rows[0].n,
      1,
    );
    const future = await q(
      fixture.vehicles[0],
      new Date(now + 10 * 86400000).toISOString(),
      new Date(now + 11 * 86400000).toISOString(),
    );
    await errorCode(
      () =>
        rpc("ATTENDANT", "create_rental", {
          quote_id: future,
          vehicle_id: fixture.vehicles[0],
        }),
      "23514",
    );
  });
}
