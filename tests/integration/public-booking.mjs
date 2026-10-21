import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
export async function runPublicTests({
  db,
  connect,
  asUser,
  test,
  errorCode,
  fixture,
}) {
  const sample = JSON.parse(
    await readFile("tests/fixtures/pricing.json", "utf8"),
  );
  const service = async (fn) => {
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
  const rpc = async (name, args = []) =>
    (
      await service((c) =>
        c.query(
          `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) value`,
          args,
        ),
      )
    ).rows[0].value;
  let plan, category, vehicle, site, version;
  const visitor = "c".repeat(64),
    other = "d".repeat(64);
  const input = () => ({
    ...sample.input,
    rate_plan_id: plan,
    branch_id: fixture.branch,
    category_id: category,
    start_at: "2033-01-01T12:00:00Z",
    end_at: "2033-01-02T12:00:00Z",
  });
  const calculation = {
    engine: "v1",
    total: "100.00",
    deposit: "500.00",
    lines: [
      {
        kind: "RENTAL",
        description: "Exclusivamente teste público",
        quantity: "1.0000",
        unit_amount: "100.00",
        total: "100.00",
        snapshot: {},
        additional_service_id: null,
      },
    ],
  };
  const customer = {
    person_type: "PF",
    name: "Visitante de teste",
    tax_document: "12345678909",
    email: "visitor@example.invalid",
    phone: "85999999999",
    birth_date: null,
    notes: null,
    address: {
      postal_code: "60000000",
      street: "Rua de teste",
      number: "1",
      district: "Centro",
      city: "Fortaleza",
      state: "CE",
      complement: null,
    },
  };
  async function quote(who = visitor, key = randomUUID()) {
    const i = input(),
      ctx = await rpc("public_pricing_context", [i]);
    return rpc("persist_public_quote", [
      who,
      i,
      ctx.fingerprint,
      calculation,
      key,
    ]);
  }
  await test("publicação exige ADMIN, versão e contato/políticas; catálogo e projeções antigas fecham juntos", async () => {
    const row = (
      await db.query(
        "select value,version from public.system_settings where key='public_site'",
      )
    ).rows[0];
    site = row.value;
    version = row.version;
    await errorCode(
      () =>
        asUser("MANAGER", (c) =>
          c.query("select public.set_public_site($1,$2)", [site, version]),
        ),
      "42501",
    );
    await errorCode(
      () =>
        asUser("ADMIN", (c) =>
          c.query("select public.set_public_site($1,$2)", [site, version + 1]),
        ),
      "40001",
    );
    version = (
      await asUser("ADMIN", (c) =>
        c.query("select public.set_public_site($1,$2) v", [
          { ...site, enabled: false },
          version,
        ]),
      )
    ).rows[0].v;
    assert.equal(await rpc("public_catalog", [{}]), null);
    assert.equal(
      (
        await asUser("ANON", (c) =>
          c.query("select * from public.catalog_vehicles()"),
        )
      ).rowCount,
      0,
    );
    assert.equal(
      (
        await asUser("ANON", (c) =>
          c.query("select * from public.catalog_categories()"),
        )
      ).rowCount,
      0,
    );
    version = (
      await asUser("ADMIN", (c) =>
        c.query("select public.set_public_site($1,$2) v", [site, version]),
      )
    ).rows[0].v;
    category = (
      await db.query(
        "insert into public.vehicle_categories(name,capacity) values('Categoria pública teste',5) returning id",
      )
    ).rows[0].id;
    vehicle = (
      await db.query(
        "insert into public.vehicles(category_id,branch_id,plate,make,model,manufacture_year,model_year,color,fuel,transmission,passengers,doors) values($1,$2,'PUB6A01','Público','Teste',2026,2026,'Azul','FLEX','MANUAL',5,4) returning id",
        [category, fixture.branch],
      )
    ).rows[0].id;
    plan = (
      await db.query(
        "insert into public.rate_plans(name,period_unit,policy) values('Somente teste público','DAY',$1) returning id",
        [sample.policy],
      )
    ).rows[0].id;
    await db.query(
      "insert into public.rate_plan_prices(name,rate_plan_id,category_id,validity,amount) values('Tarifa pública de teste',$1,$2,'[2032-01-01,2034-01-01)',100)",
      [plan, category],
    );
  });
  await test("catálogo filtra e pagina por allowlist sem placa/documento/notas; plano não publicado não cota", async () => {
    const catalog = await rpc("public_catalog", [{ category, page: 1 }]);
    assert.equal(catalog.data.length, 1);
    assert.equal(catalog.data[0].id, vehicle);
    for (const k of [
      "plate",
      "chassis",
      "renavam",
      "internal_notes",
      "mileage",
    ])
      assert.equal(Object.hasOwn(catalog.data[0], k), false, k);
    assert.equal((await rpc("public_catalog", [{ q: "%_" }])).data.length, 0);
    assert.equal(
      (await rpc("public_catalog", [{ category, page: 2 }])).data.length,
      0,
    );
    await errorCode(() => rpc("public_pricing_context", [input()]), "23514");
    await asUser("MANAGER", (c) =>
      c.query("update public.rate_plans set public_enabled=true where id=$1", [
        plan,
      ]),
    );
    assert.equal(
      (await rpc("public_booking_options")).plans.some((p) => p.id === plan),
      true,
    );
    for (const role of ["ANON", "ADMIN"])
      await errorCode(
        () =>
          asUser(role, (c) =>
            c.query("select public.public_pricing_context($1)", [input()]),
          ),
        "42501",
      );
  });
  await test("cotação pública é imutável, sem desconto, isolada por visitante e idempotente sob concorrência", async () => {
    const key = randomUUID(),
      results = await Promise.all([quote(visitor, key), quote(visitor, key)]);
    assert.deepEqual(results[0], results[1]);
    const q = results[0];
    const own = await rpc("public_quote_owned", [visitor, q.id]);
    assert.deepEqual(Object.keys(own).sort(), [
      "deposit",
      "expires_at",
      "id",
      "items",
      "total",
    ]);
    assert.equal(own.total, "100.00");
    assert.equal(await rpc("public_quote_owned", [other, q.id]), null);
    await errorCode(
      () =>
        rpc("public_pricing_context", [
          { ...input(), discount_amount: "1.00" },
        ]),
      "23514",
    );
    await errorCode(
      () =>
        rpc("find_public_operation", [
          visitor,
          "QUOTE",
          key,
          { ...input(), instructions: "Alteração" },
        ]),
      "23505",
    );
    await errorCode(
      () => db.query("update public.quotes set total=1 where id=$1", [q.id]),
      "23514",
    );
    assert.equal(await rpc("public_quote_stock", [visitor, q.id]), 1);
  });
  await test("solicitação pública grava cliente novo, intake/aceite/histórico/outbox; token só hash e análise manual", async () => {
    const q = await quote(),
      key = randomUUID(),
      hash = "e".repeat(64),
      payload = { quote_id: q.id, customer, terms_version: site.terms_version };
    const r = await rpc("request_public_reservation", [
      visitor,
      q.id,
      customer,
      site.terms_version,
      hash,
      key,
    ]);
    assert.equal(r.status, "REQUESTED");
    assert.deepEqual(
      await rpc("request_public_reservation", [
        visitor,
        q.id,
        customer,
        site.terms_version,
        hash,
        key,
      ]),
      r,
    );
    assert.deepEqual(
      await rpc("find_public_operation", [visitor, "REQUEST", key, payload]),
      r,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.vehicle_allocations where reservation_id=$1",
          [r.id],
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.outbox_events where payload->>'reservation_id'=$1 and event_type='reservation.requested'",
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
    assert.equal(
      (
        await asUser("ATTENDANT", (c) =>
          c.query(
            "select * from public.public_reservation_submissions where reservation_id=$1",
            [r.id],
          ),
        )
      ).rowCount,
      1,
    );
    assert.equal(
      (
        await asUser("FINANCE", (c) =>
          c.query("select * from public.public_reservation_submissions"),
        )
      ).rowCount,
      0,
    );
    await errorCode(
      () =>
        asUser("ANON", (c) =>
          c.query("select * from public.public_reservation_submissions"),
        ),
      "42501",
    );
    await errorCode(
      () =>
        rpc("request_public_reservation", [
          visitor,
          q.id,
          customer,
          site.terms_version,
          "f".repeat(64),
          randomUUID(),
        ]),
      "23505",
    );
    const status = await rpc("reservation_status_by_token", [r.id, hash]);
    assert.deepEqual(Object.keys(status).sort(), [
      "id",
      "status",
      "updated_at",
    ]);
    await asUser("MANAGER", (c) =>
      c.query(
        "select public.decide_staff_reservation($1,1,'CONFIRMED','Conferência de teste',$2)",
        [r.id, randomUUID()],
      ),
    );
    assert.equal(
      (await rpc("reservation_status_by_token", [r.id, hash])).status,
      "CONFIRMED",
    );
  });
  await test("cliente existente não é sobrescrito; visitante alheio e aceite antigo são recusados", async () => {
    const original = (
        await db.query("select * from public.customers where id=$1", [
          fixture.customer,
        ])
      ).rows[0],
      q = await quote();
    const declared = {
      ...customer,
      name: "Outro nome declarado",
      tax_document: original.tax_document,
      email: "new@example.invalid",
    };
    await errorCode(
      () =>
        rpc("request_public_reservation", [
          other,
          q.id,
          declared,
          site.terms_version,
          "1".repeat(64),
          randomUUID(),
        ]),
      "23514",
    );
    await errorCode(
      () =>
        rpc("request_public_reservation", [
          visitor,
          q.id,
          declared,
          randomUUID(),
          "1".repeat(64),
          randomUUID(),
        ]),
      "23514",
    );
    const r = await rpc("request_public_reservation", [
      visitor,
      q.id,
      declared,
      site.terms_version,
      "1".repeat(64),
      randomUUID(),
    ]);
    assert.deepEqual(
      (
        await db.query("select * from public.customers where id=$1", [
          fixture.customer,
        ])
      ).rows[0],
      original,
    );
    assert.equal(
      (
        await db.query(
          "select customer_data->>'name' n from public.public_reservation_submissions where reservation_id=$1",
          [r.id],
        )
      ).rows[0].n,
      declared.name,
    );
  });
  await test("imagem só é pública após publicação explícita; arquivar/revogar corta acesso e arquivo segue privado", async () => {
    const owner = (
        await db.query(
          "select id from public.profiles where active order by id limit 1",
        )
      ).rows[0].id,
      id = randomUUID(),
      path = `${vehicle}/${id}.jpg`;
    await db.query(
      "insert into public.registry_files(id,kind,vehicle_id,bucket,storage_path,label,media_type,byte_size,sha256,uploaded_by) values($1,'VEHICLE_IMAGE',$2,'vehicle-images',$3,'Imagem teste','image/jpeg',10,$4,$5)",
      [id, vehicle, path, "a".repeat(64), owner],
    );
    await db.query(
      "insert into storage.objects(bucket_id,name) values('vehicle-images',$1)",
      [path],
    );
    await db.query(
      "update public.registry_files set status='READY' where id=$1",
      [id],
    );
    assert.equal(await rpc("public_image_path", [id]), null);
    await asUser("MANAGER", (c) =>
      c.query("select public.publish_catalog_image($1,true)", [id]),
    );
    assert.equal(await rpc("public_image_path", [id]), path);
    await errorCode(
      () =>
        asUser("ATTENDANT", (c) =>
          c.query("select public.publish_catalog_image($1,false)", [id]),
        ),
      "42501",
    );
    await asUser("MANAGER", (c) =>
      c.query("select public.publish_catalog_image($1,false)", [id]),
    );
    assert.equal(await rpc("public_image_path", [id]), null);
    await asUser("MANAGER", (c) =>
      c.query("select public.publish_catalog_image($1,true)", [id]),
    );
    await asUser("MANAGER", (c) =>
      c.query("select public.archive_registry_file($1)", [id]),
    );
    assert.equal(await rpc("public_image_path", [id]), null);
  });
}
