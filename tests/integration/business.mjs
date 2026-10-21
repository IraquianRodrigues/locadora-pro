import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { users, sessions, rental } from "./support/fixtures.mjs";

export async function runBusinessTests({
  db,
  connect,
  asUser,
  test,
  errorCode,
  fixture,
}) {
  const rpc = async (role, name, input, key = randomUUID()) =>
    (
      await asUser(role, (c) =>
        c.query(`select public.${name}($1,$2) result`, [input, key]),
      )
    ).rows[0].result;
  const finance = (input, role = "FINANCE", key) =>
    rpc(role, "finance_command", input, key);
  const service = async (name, args = []) => {
    const c = await connect();
    try {
      await c.query("begin");
      await c.query("set local role service_role");
      const result = await c.query(
        `select * from public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")})`,
        args,
      );
      await c.query("commit");
      return result.rows;
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      await c.end();
    }
  };
  const scalar = async (sql, args = []) =>
    Object.values((await db.query(sql, args)).rows[0])[0];
  const charge = async (amount = "100.00", rentalId = null) =>
    (
      await finance({
        action: "CHARGE",
        customer_id: fixture.customer,
        rental_id: rentalId,
        kind: "MANUAL",
        amount,
        due_at: new Date().toISOString(),
        competence_at: new Date().toISOString(),
        description: "Cobrança exclusivamente de teste",
      })
    ).id;
  const payment = async (amount, allocations = [], key) =>
    finance(
      {
        action: "PAYMENT",
        customer_id: fixture.customer,
        payment_method_id: fixture.method,
        amount,
        received: true,
        allocations,
      },
      "FINANCE",
      key,
    );
  const refund = (input) =>
    finance({
      action: "REFUND",
      payment_id: null,
      deposit_id: null,
      allocation_id: null,
      payment_method_id: fixture.method,
      paid_out: true,
      reason: "Devolução exclusivamente de teste",
      ...input,
    });
  const balance = (id) => scalar("select app_private.charge_balance($1)", [id]);
  const held = (id) => scalar("select app_private.deposit_balance($1)", [id]);
  const makeVehicle = async (plate) =>
    scalar(
      `insert into public.vehicles(category_id,branch_id,plate,make,model,manufacture_year,model_year,color,fuel,transmission,passengers,doors) values($1,$2,$3,'Teste','Fase oito',2026,2026,'Branco','FLEX','MANUAL',5,4) returning id`,
      [fixture.category, fixture.branch, plate],
    );
  const now = Date.now(),
    iso = (delta) => new Date(now + delta).toISOString();
  const from = iso(-86400000),
    to = iso(86400000);
  const report = async (kind, role = "FINANCE", pageSize = 100) =>
    (
      await asUser(role, (c) =>
        c.query("select public.business_report($1,$2,$3,1,$4) result", [
          kind,
          from,
          to,
          pageSize,
        ]),
      )
    ).rows[0].result;
  let c1,
    p1,
    allocation,
    deposit,
    applied,
    rentalId,
    vehicle,
    maintenance,
    expense;

  await test("F8 recebimento explícito, BRL canônico, RBAC e rollback de alocação inválida", async () => {
    c1 = await charge();
    const count = await scalar("select count(*) from public.payments");
    const input = {
      action: "PAYMENT",
      customer_id: fixture.customer,
      payment_method_id: fixture.method,
      amount: "10.00",
      allocations: [],
      received: false,
    };
    await errorCode(() => finance(input), "22023");
    await errorCode(
      () => finance({ ...input, received: true, amount: "1.001" }),
      "22023",
    );
    await errorCode(
      () => finance({ ...input, received: true }, "ATTENDANT"),
      "42501",
    );
    await errorCode(
      () => payment("10.00", [{ charge_id: c1, amount: "11.00" }]),
      "23514",
    );
    assert.equal(await scalar("select count(*) from public.payments"), count);
    assert.equal(await balance(c1), "100.00");
  });
  await test("F8 pagamento parcial idempotente, crédito livre e reembolso alocado reabre obrigação", async () => {
    const key = randomUUID(),
      lines = [{ charge_id: c1, amount: "30.00" }];
    p1 = (await payment("50.00", lines, key)).id;
    assert.equal((await payment("50.00", lines, key)).id, p1);
    assert.equal(await balance(c1), "70.00");
    assert.equal(
      await scalar("select app_private.payment_free($1)", [p1]),
      "20.00",
    );
    allocation = await scalar(
      "select id from public.payment_allocations where payment_id=$1",
      [p1],
    );
    await refund({
      payment_id: p1,
      allocation_id: allocation,
      amount: "10.00",
    });
    assert.equal(await balance(c1), "80.00");
    assert.equal(
      await scalar("select app_private.payment_free($1)", [p1]),
      "20.00",
    );
    await errorCode(
      () =>
        refund({ payment_id: p1, allocation_id: allocation, amount: "20.01" }),
      "23514",
    );
    await refund({ payment_id: p1, amount: "5.00" });
    await errorCode(() => refund({ payment_id: p1, amount: "15.01" }), "23514");
    await finance({
      action: "ALLOCATE",
      payment_id: p1,
      charge_id: c1,
      amount: "15.00",
    });
    assert.equal(await balance(c1), "65.00");
  });
  await test("F8 concorrência de recebimentos não permite pagar cobrança duas vezes", async () => {
    const id = await charge("40.00");
    const results = await Promise.allSettled([
      payment("40.00", [{ charge_id: id, amount: "40.00" }]),
      payment("40.00", [{ charge_id: id, amount: "40.00" }]),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      results.find((r) => r.status === "rejected").reason.code,
      "23514",
    );
    assert.equal(await balance(id), "0.00");
  });
  await test("F8 desconto exige política e respeita limite acumulado do cargo", async () => {
    const id = await charge();
    const discount = {
      action: "ADJUST",
      charge_id: id,
      kind: "DISCOUNT",
      amount: "10.00",
      reason: "Desconto exclusivamente de teste",
    };
    await errorCode(() => finance(discount, "FINANCE"), "42501");
    await errorCode(() => finance(discount, "MANAGER"), "23514");
    await rpc("ADMIN", "finance_configuration", {
      kind: "POLICY",
      admin_discount_bps: 2000,
      manager_discount_bps: 1000,
      expected_version: 0,
    });
    await finance(discount, "MANAGER");
    await errorCode(
      () => finance({ ...discount, amount: "0.01" }, "MANAGER"),
      "23514",
    );
    await finance({ ...discount, kind: "CORRECTION", amount: "20.00" });
    assert.equal(await balance(id), "70.00");
    await errorCode(
      () => finance({ ...discount, kind: "CANCEL", amount: "70.01" }),
      "23514",
    );
  });
  await test("F8 caução recebida, aplicada e estornada preserva histórico e saldo", async () => {
    vehicle = await makeVehicle("OIT8A01");
    rentalId = (
      await rental(db, fixture, {
        vehicle,
        start: "2034-01-01T12:00:00Z",
        end: "2034-01-03T12:00:00Z",
      })
    ).id;
    const id = await charge("100.00", rentalId);
    deposit = (
      await finance({
        action: "DEPOSIT_RECEIVE",
        rental_id: rentalId,
        payment_method_id: fixture.method,
        amount: "150.00",
        received: true,
      })
    ).id;
    applied = (
      await finance({
        action: "DEPOSIT_APPLY",
        deposit_id: deposit,
        charge_id: id,
        amount: "100.00",
        reason: "Uso de caução confirmado",
      })
    ).id;
    assert.equal(await balance(id), "0.00");
    assert.equal(await held(deposit), "50.00");
    await finance({
      action: "DEPOSIT_UNAPPLY",
      application_id: applied,
      amount: "40.00",
      reason: "Estorno da aplicação confirmado",
    });
    assert.equal(await held(deposit), "90.00");
    assert.equal(await balance(id), "40.00");
    await errorCode(
      () =>
        finance({
          action: "DEPOSIT_UNAPPLY",
          application_id: applied,
          amount: "60.01",
          reason: "Estorno acima do saldo",
        }),
      "23514",
    );
    await errorCode(
      () =>
        finance({
          action: "DEPOSIT_APPLY",
          deposit_id: deposit,
          charge_id: c1,
          amount: "1.00",
          reason: "Locação divergente recusada",
        }),
      "23514",
    );
    await errorCode(
      () =>
        asUser("FINANCE", (c) =>
          c.query("update public.deposits set amount=1 where id=$1", [deposit]),
        ),
      "42501",
    );
  });
  await test("F8 reembolsos concorrentes de caução têm apenas um vencedor", async () => {
    const results = await Promise.allSettled([
      refund({ deposit_id: deposit, amount: "90.00" }),
      refund({ deposit_id: deposit, amount: "90.00" }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(await held(deposit), "0.00");
    await errorCode(
      () =>
        rpc("MANAGER", "cancel_settled_rental", {
          rental_id: rentalId,
          expected_version: 1,
          reason: "Cancelamento solicitado em teste",
        }),
      "23514",
    );
    await finance({
      action: "DEPOSIT_UNAPPLY",
      application_id: applied,
      amount: "60.00",
      reason: "Liberação restante da aplicação",
    });
    await refund({ deposit_id: deposit, amount: "60.00" });
    const version = await scalar(
      "select version from public.rentals where id=$1",
      [rentalId],
    );
    const result = await rpc("MANAGER", "cancel_settled_rental", {
      rental_id: rentalId,
      expected_version: version,
      reason: "Cancelamento após restituição real",
    });
    assert.equal(result.status, "CANCELLED");
    assert.equal(
      await scalar(
        "select count(*) from public.vehicle_allocations where rental_id=$1 and released_at is null",
        [rentalId],
      ),
      "0",
    );
    assert.equal(
      await scalar("select app_private.rental_due($1)", [rentalId]),
      "0",
    );
  });
  await test("F8 despesa exige desembolso confirmado e estorno não excede o original", async () => {
    const input = {
      action: "EXPENSE",
      vehicle_id: vehicle,
      maintenance_id: null,
      amount: "50.10",
      occurred_at: iso(-1000),
      payment_method_id: fixture.method,
      description: "Despesa exclusivamente de teste",
      paid: true,
    };
    await errorCode(() => finance({ ...input, paid: false }), "22023");
    await errorCode(
      () => finance({ ...input, occurred_at: iso(86400000) }),
      "22023",
    );
    expense = (await finance(input)).id;
    await finance({
      action: "EXPENSE_REVERSE",
      expense_id: expense,
      amount: "20.05",
      confirmed: true,
      reason: "Restituição de despesa confirmada",
    });
    await errorCode(
      () =>
        finance({
          action: "EXPENSE_REVERSE",
          expense_id: expense,
          amount: "30.06",
          confirmed: true,
          reason: "Restituição acima do saldo",
        }),
      "23514",
    );
  });
  await test("F8 projeções financeiras paginadas não expõem CPF, placa ou documentos", async () => {
    const options = (
      await asUser("FINANCE", (c) =>
        c.query("select public.finance_options() result"),
      )
    ).rows[0].result;
    assert.equal(JSON.stringify(options).includes("52998224725"), false);
    assert.equal(JSON.stringify(options).includes("OIT8A01"), false);
    for (const kind of [
      "CHARGES",
      "PAYMENTS",
      "DEPOSITS",
      "REFUNDS",
      "EXPENSES",
      "ADJUSTMENTS",
    ]) {
      const data = (
        await asUser("FINANCE", (c) =>
          c.query("select public.finance_register($1,1,null,null) result", [
            kind,
          ]),
        )
      ).rows[0].result;
      assert.ok(data.total > 0);
      assert.ok(data.rows.length <= 20);
    }
    await errorCode(
      () =>
        asUser("ATTENDANT", (c) => c.query("select public.finance_options()")),
      "42501",
    );
  });
  const maintenanceRow = async () =>
    (
      await db.query("select * from public.maintenance_records where id=$1", [
        maintenance,
      ])
    ).rows[0];
  const mcmd = async (action, patch = {}, role = "MANAGER") =>
    rpc(role, "maintenance_command", {
      action,
      maintenance_id: maintenance,
      expected_version: (await maintenanceRow()).version,
      ...patch,
    });
  const createMaintenance = (patch = {}, role = "MANAGER") =>
    rpc(role, "maintenance_command", {
      action: "CREATE",
      vehicle_id: vehicle,
      kind: "OIL",
      mileage: 0,
      start_at: iso(-3600000),
      end_at: iso(3600000),
      blocks_availability: true,
      description: "Manutenção exclusivamente de teste",
      ...patch,
    });
  await test("F8 manutenção usa exclusão única e desfaz conflito sem registro órfão", async () => {
    maintenance = (await createMaintenance()).id;
    await errorCode(() => createMaintenance(), "23P01");
    await errorCode(
      () =>
        createMaintenance(
          { start_at: iso(7200000), end_at: iso(10800000) },
          "ATTENDANT",
        ),
      "42501",
    );
    assert.equal(
      await scalar(
        "select count(*) from public.maintenance_records where vehicle_id=$1",
        [vehicle],
      ),
      "1",
    );
    await errorCode(
      () => mcmd("RESCHEDULE", { start_at: iso(1000), end_at: iso(-1000) }),
      "23514",
    );
    assert.equal((await maintenanceRow()).version, 1);
  });
  await test("F8 iniciar e prorrogar manutenção exige janela, versão e disponibilidade", async () => {
    await mcmd("RESCHEDULE", { start_at: iso(7200000), end_at: iso(10800000) });
    await errorCode(() => mcmd("START"), "23514");
    await mcmd("RESCHEDULE", { start_at: iso(-3600000), end_at: iso(3600000) });
    const version = (await maintenanceRow()).version;
    await mcmd("START");
    await errorCode(
      () =>
        rpc("MANAGER", "maintenance_command", {
          action: "EXTEND",
          maintenance_id: maintenance,
          expected_version: version,
          end_at: iso(7200000),
        }),
      "40001",
    );
    const future = await createMaintenance({
      start_at: iso(7200000),
      end_at: iso(10800000),
      kind: "TIRES",
    });
    await errorCode(() => mcmd("EXTEND", { end_at: iso(9000000) }), "23P01");
    assert.equal(
      new Date((await maintenanceRow()).end_at).toISOString(),
      iso(3600000),
    );
    await rpc("MANAGER", "maintenance_command", {
      action: "CANCEL",
      maintenance_id: future.id,
      expected_version: future.version,
      reason: "Agenda cancelada no teste",
    });
    await mcmd("EXTEND", { end_at: iso(7200000) });
  });
  await test("F8 manutenção em andamento impede reserva fora do intervalo até ser concluída", async () => {
    await errorCode(
      () =>
        rental(db, fixture, {
          vehicle,
          start: "2035-01-01T12:00:00Z",
          end: "2035-01-03T12:00:00Z",
        }),
      "23514",
    );
  });
  await test("F8 conclusão com despesa é atômica, libera frota e cria alerta por km/data", async () => {
    const patch = {
      mileage: 100,
      next_due_on: new Date().toISOString().slice(0, 10),
      next_due_mileage: 100,
      expense: {
        amount: "70.00",
        occurred_at: iso(-1000),
        payment_method_id: fixture.method,
        description: "Serviço de manutenção de teste",
        paid: false,
      },
    };
    await errorCode(() => mcmd("COMPLETE", patch), "22023");
    assert.equal((await maintenanceRow()).status, "IN_PROGRESS");
    assert.equal(
      await scalar("select mileage from public.vehicles where id=$1", [
        vehicle,
      ]),
      "0",
    );
    await mcmd("COMPLETE", {
      ...patch,
      expense: { ...patch.expense, paid: true },
    });
    assert.equal((await maintenanceRow()).status, "COMPLETED");
    assert.equal(
      await scalar("select mileage from public.vehicles where id=$1", [
        vehicle,
      ]),
      "100",
    );
    assert.equal(
      await scalar(
        "select count(*) from public.expenses where maintenance_record_id=$1",
        [maintenance],
      ),
      "1",
    );
    assert.equal(
      await scalar(
        "select count(*) from public.vehicle_allocations where maintenance_record_id=$1 and released_at is null",
        [maintenance],
      ),
      "0",
    );
    const alerts = (
      await asUser("ATTENDANT", (c) =>
        c.query("select public.maintenance_alerts() result"),
      )
    ).rows[0].result;
    assert.ok(alerts.due.some((x) => x.id === maintenance));
    await service("queue_maintenance_alerts", [100]);
    await service("queue_maintenance_alerts", [100]);
    assert.equal(
      await scalar(
        "select count(*) from public.outbox_events where deduplication_key=$1",
        [`maintenance:${maintenance}:due`],
      ),
      "1",
    );
    await errorCode(() => mcmd("START"), "23514");
  });
  await test("F8 manutenção usa a data civil da empresa e não o fuso da conexão", async () => {
    const original = await scalar(
      "select timezone from public.company_settings where singleton",
    );
    assert.ok(original);
    try {
      await db.query(
        "update public.company_settings set timezone='America/Fortaleza' where singleton",
      );
      assert.equal(
        await scalar(
          "select app_private.company_today('2026-10-20T02:00:00Z')::text",
        ),
        "2026-10-19",
      );
      await db.query(
        "update public.company_settings set timezone='Asia/Tokyo' where singleton",
      );
      assert.equal(
        await scalar(
          "select app_private.company_today('2026-10-20T02:00:00Z')::text",
        ),
        "2026-10-20",
      );
    } finally {
      await db.query(
        "update public.company_settings set timezone=$1 where singleton",
        [original],
      );
    }
  });
  await test("F8 dashboard respeita domínio e separa caução de receitas", async () => {
    for (const role of ["ATTENDANT", "FINANCE", "MANAGER"]) {
      const data = (
        await asUser(role, (c) =>
          c.query("select public.business_dashboard($1,$2) result", [from, to]),
        )
      ).rows[0].result;
      assert.equal(!!data.operations, role !== "FINANCE");
      assert.equal(!!data.finance, role !== "ATTENDANT");
      if (data.finance) {
        assert.equal(
          data.finance.deposit_received,
          await scalar(
            "select coalesce(sum(amount),0)::text from public.deposits where kind='RECEIVED' and created_at>=$1 and created_at<$2",
            [from, to],
          ),
        );
        assert.equal(
          data.finance.received,
          await scalar(
            "select coalesce(sum(amount),0)::text from public.payments where confirmed_at>=$1 and confirmed_at<$2",
            [from, to],
          ),
        );
      }
    }
  });
  await test("F8 relatórios usam competência, paginação e permissões revalidadas", async () => {
    const id = (
      await finance({
        action: "CHARGE",
        customer_id: fixture.customer,
        rental_id: null,
        kind: "MANUAL",
        amount: "33.33",
        due_at: iso(0),
        competence_at: iso(-86400000 * 10),
        description: "Competência distinta do vencimento",
      })
    ).id;
    assert.equal(
      (await report("REVENUE")).rows.some((x) => x.id === id),
      false,
    );
    assert.ok((await report("BALANCES")).rows.some((x) => x.id === id));
    assert.equal((await report("REVENUE", "FINANCE", 1)).rows.length, 1);
    await errorCode(() => report("REVENUE", "ATTENDANT"), "42501");
    await errorCode(() => report("OCCUPANCY", "FINANCE"), "42501");
    for (const kind of [
      "RECEIPTS",
      "EXPENSES",
      "PROFITABILITY",
      "RESERVATIONS",
      "OCCUPANCY",
      "RECURRING",
      "OVERDUE",
      "MAINTENANCE",
    ]) {
      const data = await report(kind, "MANAGER");
      assert.ok(Array.isArray(data.rows));
    }
    const occupancy = (await report("OCCUPANCY", "MANAGER")).rows.find(
      (x) => x.vehicle_id === vehicle,
    );
    assert.ok(occupancy);
    assert.ok(Number(occupancy.fleet_hours) >= 0);
    await asUser("FINANCE", (c) =>
      c.query("select public.audit_report_export('REVENUE',$1,$2,1,1)", [
        from,
        to,
      ]),
    );
    assert.equal(
      await scalar(
        "select count(*) from public.audit_logs where entity_type='report' and actor_id=$1",
        [users.FINANCE],
      ),
      "1",
    );
  });
  await test("F8 outbox gera notificações próprias uma vez e não habilita email automaticamente", async () => {
    assert.equal(
      await scalar(
        "select count(*) from public.notification_routes where channel='EMAIL' and enabled",
      ),
      "0",
    );
    for (let i = 0; i < 8; i++)
      await service("dispatch_notification_events", [100]);
    const count = await scalar("select count(*) from public.notifications");
    assert.ok(
      Number(
        await scalar(
          "select count(*) from public.notifications n join public.outbox_events o on o.id=n.outbox_event_id where o.event_type='rental.cancel' and n.channel='IN_APP' and n.recipient_profile_id=$1 and n.body_snapshot like '%locação cancelada%'",
          [users.ATTENDANT],
        ),
      ) > 0,
    );
    assert.ok(Number(count) > 0);
    await service("dispatch_notification_events", [100]);
    assert.equal(
      await scalar("select count(*) from public.notifications"),
      count,
    );
    for (const role of ["FINANCE", "ATTENDANT"]) {
      const rows = (
        await asUser(role, (c) => c.query("select * from public.notifications"))
      ).rows;
      assert.ok(rows.length > 0);
      assert.ok(
        rows.every(
          (x) =>
            x.recipient_profile_id === users[role] && x.channel === "IN_APP",
        ),
      );
    }
    const own = await scalar(
      "select id from public.notifications where recipient_profile_id=$1 limit 1",
      [users.FINANCE],
    );
    await asUser("FINANCE", (c) =>
      c.query("select public.read_notification($1)", [own]),
    );
    assert.ok(
      await scalar("select read_at from public.notifications where id=$1", [
        own,
      ]),
    );
    await errorCode(
      () =>
        asUser("ATTENDANT", (c) =>
          c.query("select public.read_notification($1)", [own]),
        ),
      "P0002",
    );
    await asUser("FINANCE", async (c) => {
      await c.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify({ sub: users.FINANCE, session_id: sessions.ADMIN }),
      ]);
      assert.equal(
        (await c.query("select * from public.notifications")).rows.length,
        0,
      );
    });
  });
  await test("F8 RPC anterior respeita ajustes e busca localiza opções fora da lista inicial", async () => {
    const id = await charge("100.00");
    await finance({
      action: "ADJUST",
      charge_id: id,
      kind: "CORRECTION",
      amount: "99.00",
      reason: "Correção de cobrança confirmada",
    });
    await errorCode(
      () =>
        asUser("FINANCE", (c) =>
          c.query("select public.confirm_charge_payment($1,$2,1.01,true,$3)", [
            id,
            fixture.method,
            randomUUID(),
          ]),
        ),
      "23514",
    );
    await asUser("FINANCE", (c) =>
      c.query("select public.confirm_charge_payment($1,$2,1.00,true,$3)", [
        id,
        fixture.method,
        randomUUID(),
      ]),
    );
    assert.equal(await balance(id), "0.00");
    const options = (
      await asUser("FINANCE", (c) =>
        c.query("select public.finance_options($1) result", [vehicle]),
      )
    ).rows[0].result;
    assert.deepEqual(
      options.vehicles.map((v) => v.id),
      [vehicle],
    );
    assert.equal(options.customers.length, 0);
  });
  await test("F8 alocação de cliente divergente é recusada sem recebimento parcial", async () => {
    const customer = await scalar(
      "select id from public.customers where id<>$1 limit 1",
      [fixture.customer],
    );
    assert.ok(customer);
    const id = (
      await finance({
        action: "CHARGE",
        customer_id: customer,
        rental_id: null,
        kind: "MANUAL",
        amount: "10.00",
        due_at: iso(0),
        competence_at: iso(0),
        description: "Cobrança de outro cliente de teste",
      })
    ).id;
    const count = await scalar("select count(*) from public.payments");
    await errorCode(
      () => payment("10.00", [{ charge_id: id, amount: "10.00" }]),
      "23503",
    );
    assert.equal(await scalar("select count(*) from public.payments"), count);
  });
  let emailId, lease, emailTemplate;
  await test("F8 email opt-in usa snapshot e claim concorrente exclusivo", async () => {
    const input = {
      kind: "TEMPLATE",
      name: "test_email",
      version: 1,
      channel: "EMAIL",
      subject: "Reserva {reference}",
      body: "Atualização do registro: {status}. Consulte sua reserva.",
    };
    await errorCode(() => rpc("MANAGER", "notification_setup", input), "42501");
    await errorCode(
      () =>
        rpc("ADMIN", "notification_setup", {
          ...input,
          body: "Variável não permitida: {cpf}",
        }),
      "22023",
    );
    emailTemplate = (await rpc("ADMIN", "notification_setup", input)).id;
    await rpc("ADMIN", "notification_setup", {
      kind: "ROUTE",
      event_type: "rental.cancel",
      channel: "EMAIL",
      target: "CUSTOMER",
      template_id: emailTemplate,
      enabled: true,
      expected_updated_at: null,
    });
    await db.query(
      "insert into public.outbox_events(event_type,payload,deduplication_key) values('rental.cancel',$1,$2)",
      [{ rental_id: rentalId }, randomUUID()],
    );
    await service("dispatch_notification_events", [100]);
    const results = await Promise.all([
      service("claim_email_notifications", [1, "sender@example.invalid"]),
      service("claim_email_notifications", [1, "sender@example.invalid"]),
    ]);
    const claimed = results.flat();
    assert.equal(claimed.length, 1);
    emailId = claimed[0].id;
    lease = claimed[0].lease_token;
    assert.equal(claimed[0].sender_snapshot, "sender@example.invalid");
    assert.equal(claimed[0].recipient_email, "teste@example.invalid");
    await errorCode(
      () =>
        asUser("ADMIN", (c) =>
          c.query(
            "select * from public.claim_email_notifications(1,'sender@example.invalid')",
          ),
        ),
      "42501",
    );
    assert.equal(
      (
        await asUser("ADMIN", (c) =>
          c.query("select * from public.notifications where id=$1", [emailId]),
        )
      ).rows.length,
      0,
    );
  });
  await test("F8 entrega exige lease, reutiliza snapshot e aceita confirmação uma vez", async () => {
    assert.equal(
      (
        await service("finish_email_notification", [
          emailId,
          randomUUID(),
          "provider-id",
          null,
          false,
        ])
      )[0].finish_email_notification,
      false,
    );
    await service("finish_email_notification", [
      emailId,
      lease,
      null,
      "TIMEOUT",
      false,
    ]);
    await db.query(
      "update public.notifications set available_at=now()-interval '1 second' where id=$1",
      [emailId],
    );
    const [next] = await service("claim_email_notifications", [
      1,
      "changed@example.invalid",
    ]);
    assert.equal(next.id, emailId);
    assert.notEqual(next.lease_token, lease);
    assert.equal(next.sender_snapshot, "sender@example.invalid");
    assert.equal(
      (
        await service("finish_email_notification", [
          emailId,
          lease,
          "old-id",
          null,
          false,
        ])
      )[0].finish_email_notification,
      false,
    );
    assert.equal(
      (
        await service("finish_email_notification", [
          emailId,
          next.lease_token,
          "provider-id",
          null,
          false,
        ])
      )[0].finish_email_notification,
      true,
    );
    assert.equal(
      (
        await service("claim_email_notifications", [
          1,
          "sender@example.invalid",
        ])
      ).length,
      0,
    );
    await errorCode(
      () =>
        db.query(
          "update public.notifications set body_snapshot='changed' where id=$1",
          [emailId],
        ),
      "23514",
    );
  });
  await test("F8 lease perdida na última tentativa encerra job e permite revisão administrativa", async () => {
    await db.query(
      "insert into public.outbox_events(event_type,payload,deduplication_key) values('rental.cancel',$1,$2)",
      [{ rental_id: rentalId }, randomUUID()],
    );
    await service("dispatch_notification_events", [100]);
    const [job] = await service("claim_email_notifications", [
      1,
      "sender@example.invalid",
    ]);
    await db.query(
      "update public.notifications set attempts=5,locked_until=now()-interval '1 second' where id=$1",
      [job.id],
    );
    assert.equal(
      (
        await service("claim_email_notifications", [
          1,
          "sender@example.invalid",
        ])
      ).length,
      0,
    );
    assert.equal(
      await scalar("select status from public.notifications where id=$1", [
        job.id,
      ]),
      "DEAD",
    );
    await errorCode(
      () =>
        rpc("MANAGER", "retry_notification", {
          kind: "EMAIL",
          id: job.id,
          reason: "Revisão administrativa do job",
        }),
      "42501",
    );
    await rpc("ADMIN", "retry_notification", {
      kind: "EMAIL",
      id: job.id,
      reason: "Revisão administrativa do job",
    });
    const [retry] = await service("claim_email_notifications", [
      1,
      "sender@example.invalid",
    ]);
    assert.equal(retry.id, job.id);
    await service("finish_email_notification", [
      retry.id,
      retry.lease_token,
      "reconciled-id",
      null,
      false,
    ]);
  });
  await test("F8 entrega ambígua após janela de idempotência exige reconciliação", async () => {
    await db.query(
      "insert into public.outbox_events(event_type,payload,deduplication_key) values('rental.cancel',$1,$2)",
      [{ rental_id: rentalId }, randomUUID()],
    );
    await service("dispatch_notification_events", [100]);
    const [job] = await service("claim_email_notifications", [
      1,
      "sender@example.invalid",
    ]);
    await db.query(
      "update public.notifications set first_attempt_at=now()-interval '24 hours',locked_until=now()-interval '1 second' where id=$1",
      [job.id],
    );
    assert.equal(
      (
        await service("claim_email_notifications", [
          1,
          "sender@example.invalid",
        ])
      ).length,
      0,
    );
    assert.equal(
      await scalar("select status from public.notifications where id=$1", [
        job.id,
      ]),
      "DEAD",
    );
    await errorCode(
      () =>
        rpc("ADMIN", "retry_notification", {
          kind: "EMAIL",
          id: job.id,
          reason: "Nova tentativa exige reconciliação",
        }),
      "23514",
    );
  });
}
