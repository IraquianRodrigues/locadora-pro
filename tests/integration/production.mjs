import assert from "node:assert/strict";
export async function runProductionTests({
  db,
  connect,
  asUser,
  test,
  errorCode,
}) {
  await test("Homologação: views financeiras invoker preservam projeções e negam acesso sem cargo", async () => {
    const views = [
      "finance_customers",
      "finance_vehicles",
      "finance_reservations",
      "finance_contracts",
      "finance_charge_balances",
    ];
    for (const view of views) {
      const options = (
        await db.query(
          "select reloptions from pg_class where oid=$1::regclass",
          [`public.${view}`],
        )
      ).rows[0].reloptions;
      assert.ok(options.includes("security_invoker=true"));
      const finance = await asUser("FINANCE", (c) =>
        c.query(`select * from public.${view}`),
      );
      assert.ok(
        !finance.fields.some((f) =>
          [
            "tax_document",
            "email",
            "phone",
            "address",
            "plate",
            "storage_path",
          ].includes(f.name),
        ),
      );
      for (const role of ["REVOKED", "UNASSIGNED"])
        assert.equal(
          (await asUser(role, (c) => c.query(`select * from public.${view}`)))
            .rowCount,
          0,
        );
      await errorCode(
        () => asUser("ANON", (c) => c.query(`select * from public.${view}`)),
        "42501",
      );
    }
    assert.equal(
      (
        await db.query(
          "select to_regclass('public.rental_location_responsible') idx",
        )
      ).rows[0].idx,
      null,
    );
    assert.ok(
      (
        await db.query(
          "select exists(select from pg_indexes where schemaname='public' and tablename='rental_locations' and indexdef like '%USING btree (responsible_id)') idx",
        )
      ).rows[0].idx,
    );
  });
  await test("F9 prontidão é exclusiva do worker e verifica schema/RLS/buckets privados", async () => {
    for (const role of ["ANON", "ADMIN", "FINANCE"])
      await errorCode(
        () =>
          asUser(role, (c) => c.query("select public.operational_readiness()")),
        "42501",
      );
    const client = await connect();
    try {
      await client.query("set role service_role");
      assert.deepEqual(
        (await client.query("select public.operational_readiness() result"))
          .rows[0].result,
        { schema: true, storage: true, rls: true },
      );
    } finally {
      await client.end();
    }
  });
  await test("F9 filtro de despesas por período usa índice com volume de teste", async () => {
    await db.query("begin");
    try {
      await db.query(
        "insert into public.expenses(amount,occurred_at,description) select 1,'2010-01-01'::timestamptz+g*interval '1 hour','Carga exclusivamente de teste' from generate_series(1,10000) g",
      );
      await db.query("analyze public.expenses");
      const result = await db.query(
        "explain (analyze,format json) select id,amount from public.expenses where occurred_at>='2010-03-01' and occurred_at<'2010-03-02' order by occurred_at desc,id limit 20",
      );
      const plan = result.rows[0]["QUERY PLAN"][0];
      assert.ok(JSON.stringify(plan).includes("expenses_period"));
      console.log(
        `DB PERF despesas 10000 linhas: ${plan["Execution Time"]} ms; índice expenses_period`,
      );
    } finally {
      await db.query("rollback");
    }
  });
}
