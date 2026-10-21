import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { users, sessions, quote as legacyQuote } from "./support/fixtures.mjs";

export async function runReservationTests({
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
  const policy = samples.policy;
  let plan, category, vehicle, price, specific, addon;
  const key = () => randomUUID();
  const context = async (input) =>
    (
      await asUser("ATTENDANT", (c) =>
        c.query("select public.staff_pricing_context($1) result", [input]),
      )
    ).rows[0].result;
  const asService = async (fn) => {
    const c = await connect();
    try {
      await c.query("begin");
      await c.query("set local role service_role");
      const result = await fn(c);
      await c.query("commit");
      return result;
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      await c.end();
    }
  };
  function input(patch = {}) {
    return {
      ...samples.input,
      rate_plan_id: plan,
      branch_id: fixture.branch,
      category_id: category,
      ...patch,
    };
  }
  const calculation = (amount = "100.00", patch = {}) => ({
    engine: "v1",
    total: amount,
    deposit: policy.deposit_amount,
    lines: [
      {
        kind: "RENTAL",
        description: "Apenas teste SQL",
        quantity: "1.0000",
        unit_amount: amount,
        total: amount,
        additional_service_id: null,
        snapshot: {},
      },
    ],
    ...patch,
  });
  async function persist(
    i,
    ctx,
    k = key(),
    calc = calculation(),
    actor = "ATTENDANT",
  ) {
    return (
      await asService((c) =>
        c.query("select public.persist_staff_quote($1,$2,$3,$4,$5,$6) result", [
          users[actor],
          sessions[actor],
          i,
          ctx.fingerprint,
          calc,
          k,
        ]),
      )
    ).rows[0].result;
  }
  async function makeQuote(i = input(), actor = "ATTENDANT") {
    const ctx = await context(i);
    return persist(i, ctx, key(), calculation(ctx.price.amount), actor);
  }
  async function request(
    q,
    k = key(),
    hash = createHash("sha256").update(key()).digest("hex"),
  ) {
    return (
      await asUser("ATTENDANT", (c) =>
        c.query("select public.request_staff_reservation($1,$2,$3,$4) result", [
          q.id,
          fixture.customer,
          hash,
          k,
        ]),
      )
    ).rows[0].result;
  }
  async function decide(
    id,
    version = 1,
    target = "CONFIRMED",
    k = key(),
    role = "MANAGER",
  ) {
    return (
      await asUser(role, (c) =>
        c.query(
          "select public.decide_staff_reservation($1,$2,$3,'Decisão de teste',$4) result",
          [id, version, target, k],
        ),
      )
    ).rows[0].result;
  }
  await test("tarifas reais com RLS de escrita, versão, vigência e precedência por veículo", async () => {
    category = (
      await asUser("MANAGER", (c) =>
        c.query(
          "insert into public.vehicle_categories(name,capacity) values('Categoria F5',5) returning id",
        ),
      )
    ).rows[0].id;
    vehicle = (
      await asUser("MANAGER", (c) =>
        c.query(
          "insert into public.vehicles(category_id,branch_id,plate,make,model,manufacture_year,model_year,color,fuel,transmission,passengers,doors) values($1,$2,'FAS5A01','Teste','F5',2026,2026,'Azul','FLEX','MANUAL',5,4) returning id",
          [category, fixture.branch],
        ),
      )
    ).rows[0].id;
    plan = (
      await asUser("MANAGER", (c) =>
        c.query(
          "insert into public.rate_plans(name,period_unit,policy) values('Plano apenas teste F5','DAY',$1) returning id",
          [policy],
        ),
      )
    ).rows[0].id;
    price = (
      await asUser("MANAGER", (c) =>
        c.query(
          "insert into public.rate_plan_prices(name,rate_plan_id,category_id,validity,amount) values('Preço categoria F5',$1,$2,'[2030-01-01,2031-01-01)',100) returning id",
          [plan, category],
        ),
      )
    ).rows[0].id;
    specific = (
      await asUser("MANAGER", (c) =>
        c.query(
          "insert into public.rate_plan_prices(name,rate_plan_id,vehicle_id,validity,amount) values('Preço veículo F5',$1,$2,'[2030-01-01,2030-06-01)',150) returning id",
          [plan, vehicle],
        ),
      )
    ).rows[0].id;
    addon = (
      await asUser("MANAGER", (c) =>
        c.query(
          "insert into public.additional_services(name,unit,amount) values('Adicional F5','DAY',5) returning id",
        ),
      )
    ).rows[0].id;
    assert.equal((await context(input())).price.amount, "100.00");
    assert.equal(
      (await context(input({ category_id: null, vehicle_id: vehicle }))).price
        .scope,
      "VEHICLE",
    );
    await errorCode(
      () =>
        context(
          input({
            category_id: null,
            vehicle_id: vehicle,
            start_at: "2030-05-31T12:00:00Z",
            end_at: "2030-06-02T12:00:00Z",
          }),
        ),
      "23514",
    );
    await errorCode(
      () =>
        asUser("ATTENDANT", (c) =>
          c.query(
            "update public.rate_plans set name='Sem permissão' where id=$1 returning id",
            [plan],
          ),
        ).then((r) => {
          if (r.rowCount === 0)
            throw Object.assign(new Error("No rows"), { code: "42501" });
        }),
      "42501",
    );
    await errorCode(
      () =>
        asUser("MANAGER", (c) =>
          c.query(
            "insert into public.rate_plan_prices(rate_plan_id,category_id,validity,amount) values($1,$2,'[2030-05-01,2030-05-03)',1)",
            [plan, category],
          ),
        ),
      "23P01",
    );
    await errorCode(
      () => context(input({ rate_plan_id: fixture.plan })),
      "23514",
    );
  });
  await test("cotação aceita só backend, verifica fingerprint e sessão, repete sem recalcular snapshot", async () => {
    const i = input({ additional_services: [{ id: addon, quantity: 1 }] }),
      ctx = await context(i),
      k = key();
    for (const role of ["ANON", "ADMIN", "ATTENDANT"])
      await errorCode(
        () =>
          asUser(role, (c) =>
            c.query("select public.persist_staff_quote($1,$2,$3,$4,$5,$6)", [
              users.ADMIN,
              sessions.ADMIN,
              i,
              ctx.fingerprint,
              calculation(),
              key(),
            ]),
          ),
        "42501",
      );
    await errorCode(
      () =>
        asService((c) =>
          c.query("select public.persist_staff_quote($1,$2,$3,$4,$5,$6)", [
            users.ATTENDANT,
            sessions.ADMIN,
            i,
            ctx.fingerprint,
            calculation(),
            key(),
          ]),
        ),
      "42501",
    );
    await asUser("MANAGER", (c) =>
      c.query("update public.rate_plan_prices set amount=110 where id=$1", [
        price,
      ]),
    );
    await errorCode(() => persist(i, ctx, k), "40001");
    const fresh = await context(i),
      saved = await persist(i, fresh, k);
    await asUser("MANAGER", (c) =>
      c.query("update public.rate_plan_prices set amount=120 where id=$1", [
        price,
      ]),
    );
    assert.deepEqual(await persist(i, fresh, k), saved);
    assert.deepEqual(
      (
        await asUser("ATTENDANT", (c) =>
          c.query("select public.find_staff_quote_operation($1,$2) result", [
            i,
            k,
          ]),
        )
      ).rows[0].result,
      saved,
    );
    const q = (
      await db.query(
        "select rules_snapshot,total from public.quotes where id=$1",
        [saved.id],
      )
    ).rows[0];
    assert.equal(q.rules_snapshot.catalog.price.amount, "110.00");
    assert.equal(q.total, "100.00");
    await errorCode(
      () => persist({ ...i, instructions: "Outro pedido" }, fresh, k),
      "23505",
    );
    await errorCode(
      () =>
        db.query("update public.quotes set total=1 where id=$1", [saved.id]),
      "23514",
    );
    await errorCode(
      () =>
        db.query("update public.quote_items set total=1 where quote_id=$1", [
          saved.id,
        ]),
      "23514",
    );
    assert.equal(
      (
        await asUser("FINANCE", (c) =>
          c.query("select * from public.quotes where id=$1", [saved.id]),
        )
      ).rowCount,
      0,
    );
    assert.equal(
      (
        await asUser("FINANCE", (c) =>
          c.query("select * from public.quote_items where quote_id=$1", [
            saved.id,
          ]),
        )
      ).rowCount,
      0,
    );
    await errorCode(
      () =>
        asUser("FINANCE", (c) =>
          c.query("select public.staff_pricing_context($1)", [i]),
        ),
      "42501",
    );
  });
  await test("política alterada gera versão auditável e novos contextos sem reescrever cotações", async () => {
    const old = await makeQuote(),
      before = await context(input());
    await asUser("MANAGER", (c) =>
      c.query(
        "update public.rate_plans set policy=jsonb_set(policy,'{deposit_amount}','\"600.00\"') where id=$1",
        [plan],
      ),
    );
    const after = await context(input());
    assert.equal(after.plan.version, before.plan.version + 1);
    assert.notEqual(after.fingerprint, before.fingerprint);
    assert.equal(
      (
        await db.query(
          "select rules_snapshot->'policy'->>'deposit_amount' d from public.quotes where id=$1",
          [old.id],
        )
      ).rows[0].d,
      "500.00",
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.pricing_rules where rate_plan_id=$1",
          [plan],
        )
      ).rows[0].n,
      2,
    );
    await errorCode(
      () =>
        asUser("ADMIN", (c) =>
          c.query(
            "update public.pricing_rules set parameters='{}' where rate_plan_id=$1",
            [plan],
          ),
        ),
      "42501",
    );
    await asUser("MANAGER", (c) =>
      c.query("update public.rate_plans set policy=$2 where id=$1", [
        plan,
        policy,
      ]),
    );
  });
  await test("desconto é revalidado no banco por permissão e limite do cargo atual", async () => {
    const i = input({
        discount_amount: "5.00",
        discount_reason: "Motivo teste",
      }),
      ctx = await context(i);
    const calc = calculation("95.00", {
      lines: [
        ...calculation().lines,
        {
          kind: "DISCOUNT",
          description: "Teste",
          quantity: "1",
          unit_amount: "5.00",
          total: "5.00",
          snapshot: {},
        },
      ],
    });
    await errorCode(() => persist(i, ctx, key(), calc), "42501");
    await persist(i, ctx, key(), calc, "MANAGER");
    await errorCode(
      () =>
        persist(
          { ...i, discount_amount: "15.00" },
          ctx,
          key(),
          calculation("85.00", {
            lines: [
              ...calculation().lines,
              {
                kind: "DISCOUNT",
                description: "Teste",
                quantity: "1",
                unit_amount: "15.00",
                total: "15.00",
                snapshot: {},
              },
            ],
          }),
          "MANAGER",
        ),
      "23514",
    );
  });
  await test("solicitação vincula cliente sem alterar cotação original, grava logística e token só em hash", async () => {
    const q = await makeQuote(),
      k = key(),
      hash = createHash("sha256").update("TOKEN_APENAS_TESTE").digest("hex");
    const r = await request(q, k, hash);
    assert.deepEqual(await request(q, k, hash), r);
    const row = (
      await db.query("select * from public.reservations where id=$1", [r.id])
    ).rows[0];
    assert.equal(row.status, "REQUESTED");
    assert.notEqual(row.quote_id, q.id);
    assert.equal(row.source_quote_id, q.id);
    assert.equal(
      (
        await db.query("select customer_id from public.quotes where id=$1", [
          q.id,
        ])
      ).rows[0].customer_id,
      null,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.reservation_locations where reservation_id=$1",
          [r.id],
        )
      ).rows[0].n,
      2,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.outbox_events where event_type='reservation.requested' and payload->>'reservation_id'=$1",
          [r.id],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.reservation_status_history where reservation_id=$1",
          [r.id],
        )
      ).rows[0].n,
      1,
    );
    const safe = (
      await db.query(
        "select safe_response from public.idempotency_keys where operation='staff_reservation' and key=$1",
        [k],
      )
    ).rows[0].safe_response;
    assert.deepEqual(Object.keys(safe).sort(), ["id", "status"]);
    const status = (
      await asService((c) =>
        c.query("select public.reservation_status_by_token($1,$2) result", [
          r.id,
          hash,
        ]),
      )
    ).rows[0].result;
    assert.deepEqual(Object.keys(status).sort(), [
      "id",
      "status",
      "updated_at",
    ]);
    assert.equal(
      (
        await asService((c) =>
          c.query("select public.reservation_status_by_token($1,$2) result", [
            r.id,
            "b".repeat(64),
          ]),
        )
      ).rows[0].result,
      null,
    );
    await errorCode(() => request(q), "23505");
    await errorCode(
      () =>
        asUser("ADMIN", (c) =>
          c.query("select public.reservation_status_by_token($1,$2)", [
            r.id,
            hash,
          ]),
        ),
      "42501",
    );
  });
  await test("aprovação simultânea por categoria tem um vencedor, mantém buffer e aceita adjacência após buffer", async () => {
    const i = input({
      start_at: "2030-07-01T12:00:00Z",
      end_at: "2030-07-02T12:00:00Z",
    });
    const q1 = await makeQuote(i),
      q2 = await makeQuote(i),
      r1 = await request(q1),
      r2 = await request(q2);
    const results = await Promise.allSettled([decide(r1.id), decide(r2.id)]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      results.filter((r) => r.status === "rejected")[0].reason.code,
      "23P01",
    );
    const winning = results.find((r) => r.status === "fulfilled").value;
    const a = (
      await db.query(
        "select upper(period) ends from public.vehicle_allocations where reservation_id=$1 and released_at is null",
        [winning.id],
      )
    ).rows[0];
    assert.equal(a.ends.toISOString(), "2030-07-02T13:00:00.000Z");
    assert.equal(
      (
        await asUser("ATTENDANT", (c) =>
          c.query("select public.staff_availability($1) result", [
            input({
              start_at: "2030-07-02T12:30:00Z",
              end_at: "2030-07-03T12:00:00Z",
            }),
          ]),
        )
      ).rows[0].result.available,
      0,
    );
    const conflict = await request(
      await makeQuote(
        input({
          start_at: "2030-07-02T12:59:59Z",
          end_at: "2030-07-03T12:00:00Z",
        }),
      ),
    );
    await errorCode(() => decide(conflict.id), "23P01");
    const adjacent = await request(
      await makeQuote(
        input({
          start_at: "2030-07-02T13:00:00Z",
          end_at: "2030-07-03T12:00:00Z",
        }),
      ),
    );
    await decide(adjacent.id);
    await errorCode(
      () =>
        asUser("ATTENDANT", (c) =>
          c.query("select public.approve_reservation($1,$2)", [r1.id, key()]),
        ),
      "42501",
    );
  });
  await test("decisões usam revisão otimista, repetição idempotente e cancelamento libera ocupação", async () => {
    const r = await request(
        await makeQuote(
          input({
            start_at: "2030-08-01T12:00:00Z",
            end_at: "2030-08-02T12:00:00Z",
          }),
        ),
      ),
      k = key();
    const reviewed = await decide(r.id, 1, "UNDER_REVIEW", k, "ATTENDANT");
    assert.deepEqual(
      await decide(r.id, 1, "UNDER_REVIEW", k, "ATTENDANT"),
      reviewed,
    );
    await errorCode(() => decide(r.id, 1), "40001");
    await decide(r.id, 2);
    await errorCode(
      () => decide(r.id, 3, "CANCELLED", key(), "ATTENDANT"),
      "42501",
    );
    await decide(r.id, 3, "CANCELLED");
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.vehicle_allocations where reservation_id=$1 and released_at is null",
          [r.id],
        )
      ).rows[0].n,
      0,
    );
    await errorCode(() => decide(r.id, 4), "23514");
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.reservation_status_history where reservation_id=$1",
          [r.id],
        )
      ).rows[0].n,
      4,
    );
  });
  await test("job de expiração restrito, idempotente e rejeição de pedido vencido em RPC antiga", async () => {
    const qid = await legacyQuote(
      db,
      fixture,
      "2030-09-01T12:00:00Z",
      "2030-09-02T12:00:00Z",
    );
    await db.query("begin");
    let rid;
    try {
      rid = (
        await db.query(
          "insert into public.reservations(customer_id,branch_id,quote_id,start_at,end_at,created_at,expires_at,lookup_token_hash,lookup_expires_at) values($1,$2,$3,'2030-09-01T12:00:00Z','2030-09-02T12:00:00Z',now()-interval '10 minutes',now()-interval '5 minutes',$4,now()-interval '1 minute') returning id",
          [
            fixture.customer,
            fixture.branch,
            qid,
            createHash("sha256").update(key()).digest("hex"),
          ],
        )
      ).rows[0].id;
      await db.query(
        "insert into public.reservation_items(reservation_id,category_id) values($1,$2)",
        [rid, category],
      );
      await db.query("commit");
    } catch (e) {
      await db.query("rollback");
      throw e;
    }
    await errorCode(
      () =>
        asUser("ATTENDANT", (c) =>
          c.query(
            "select public.transition_reservation($1,'UNDER_REVIEW','Motivo teste',$2)",
            [rid, key()],
          ),
        ),
      "23514",
    );
    await errorCode(
      () =>
        asUser("ADMIN", (c) =>
          c.query("select public.expire_pending_reservations(100)"),
        ),
      "42501",
    );
    assert.equal(
      (
        await asService((c) =>
          c.query("select public.expire_pending_reservations(100) n"),
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await asService((c) =>
          c.query("select public.expire_pending_reservations(100) n"),
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await db.query("select status from public.reservations where id=$1", [
          rid,
        ])
      ).rows[0].status,
      "EXPIRED",
    );
    assert.equal(
      (
        await asService((c) =>
          c.query(
            "select public.reservation_status_by_token($1,(select lookup_token_hash from public.reservations where id=$1)) result",
            [rid],
          ),
        )
      ).rows[0].result,
      null,
    );
  });
  await test("tarifa arquivada deixa de valer e novo preço pode ocupar a mesma vigência", async () => {
    await asUser("MANAGER", (c) =>
      c.query(
        "update public.rate_plan_prices set archived_at=now() where id=$1",
        [specific],
      ),
    );
    assert.equal(
      (await context(input({ category_id: null, vehicle_id: vehicle }))).price
        .scope,
      "CATEGORY",
    );
    await asUser("MANAGER", (c) =>
      c.query(
        "insert into public.rate_plan_prices(name,rate_plan_id,vehicle_id,validity,amount) values('Nova tarifa F5',$1,$2,'[2030-01-01,2030-06-01)',175)",
        [plan, vehicle],
      ),
    );
    assert.equal(
      (await context(input({ category_id: null, vehicle_id: vehicle }))).price
        .amount,
      "175.00",
    );
    await asUser("MANAGER", (c) =>
      c.query(
        "update public.additional_services set active=false where id=$1",
        [addon],
      ),
    );
    await errorCode(
      () =>
        context(input({ additional_services: [{ id: addon, quantity: 1 }] })),
      "23514",
    );
  });
}
