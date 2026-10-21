import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { users, rental } from "./support/fixtures.mjs";

export async function runRegistryTests({
  db,
  asUser,
  test,
  errorCode,
  fixture,
}) {
  let category, vehicle, customer, driver;
  const address = JSON.stringify({
    postal_code: "60000000",
    street: "Rua exclusivamente de teste",
    number: "10",
    district: "Centro",
    city: "Fortaleza",
    state: "CE",
    complement: null,
  });
  await test("CRUD de categorias persistente; duplicidade normalizada e permissão de escrita", async () => {
    category = (
      await asUser(
        "MANAGER",
        async (c) =>
          (
            await c.query(
              "insert into public.vehicle_categories(name,capacity,features) values('Categoria F4',5,'[\"Ar-condicionado\"]') returning id",
            )
          ).rows[0],
      )
    ).id;
    await asUser("MANAGER", (c) =>
      c.query(
        "update public.vehicle_categories set description='Descrição persistida' where id=$1",
        [category],
      ),
    );
    assert.equal(
      (
        await asUser(
          "FINANCE",
          async (c) =>
            (
              await c.query(
                "select description from public.vehicle_categories where id=$1",
                [category],
              )
            ).rows[0],
        )
      ).description,
      "Descrição persistida",
    );
    await errorCode(
      () =>
        asUser("ADMIN", (c) =>
          c.query(
            "insert into public.vehicle_categories(name,capacity) values('categoria f4',5)",
          ),
        ),
      "23505",
    );
    assert.equal(
      (
        await asUser("ATTENDANT", (c) =>
          c.query(
            "update public.vehicle_categories set name='Escalada' where id=$1",
            [category],
          ),
        )
      ).rowCount,
      0,
    );
    await asUser("MANAGER", (c) =>
      c.query(
        "update public.vehicle_categories set archived_at=clock_timestamp() where id=$1",
        [category],
      ),
    );
    assert.equal(
      await asUser(
        "ANON",
        async (c) =>
          (
            await c.query(
              "select * from public.catalog_categories() where id=$1",
              [category],
            )
          ).rowCount,
      ),
      0,
    );
    await errorCode(
      () =>
        asUser("MANAGER", (c) =>
          c.query(
            "update public.vehicle_categories set name='Editar arquivado' where id=$1",
            [category],
          ),
        ),
      "23514",
    );
    await asUser("MANAGER", (c) =>
      c.query(
        "update public.vehicle_categories set archived_at=null where id=$1",
        [category],
      ),
    );
  });
  await test("CRUD de veículos, quilometragem, vínculos e duplicidade", async () => {
    vehicle = (
      await asUser(
        "MANAGER",
        async (c) =>
          (
            await c.query(
              `insert into public.vehicles(category_id,branch_id,plate,chassis,renavam,make,model,manufacture_year,model_year,color,fuel,transmission,passengers,doors,mileage)
      values($1,$2,'FAS4A01','9BWZZZ377VT004251','12345678901','Marca teste','Modelo teste',2025,2026,'Branco','FLEX','MANUAL',5,4,100) returning id`,
              [category, fixture.branch],
            )
          ).rows[0],
      )
    ).id;
    await asUser("MANAGER", (c) =>
      c.query("update public.vehicles set mileage=110 where id=$1", [vehicle]),
    );
    assert.equal(
      (
        await asUser(
          "ATTENDANT",
          async (c) =>
            (
              await c.query("select mileage from public.vehicles where id=$1", [
                vehicle,
              ])
            ).rows[0],
        )
      ).mileage,
      "110",
    );
    await errorCode(
      () =>
        asUser("MANAGER", (c) =>
          c.query("update public.vehicles set mileage=50 where id=$1", [
            vehicle,
          ]),
        ),
      "23514",
    );
    await errorCode(
      () =>
        asUser("ADMIN", (c) =>
          c.query("update public.vehicles set plate='TST1A01' where id=$1", [
            vehicle,
          ]),
        ),
      "23505",
    );
    await errorCode(
      () =>
        asUser("ADMIN", (c) =>
          c.query("update public.vehicles set branch_id=$2 where id=$1", [
            vehicle,
            randomUUID(),
          ]),
        ),
      "23514",
    );
    await errorCode(
      () =>
        asUser("MANAGER", (c) =>
          c.query(
            "update public.vehicle_categories set archived_at=clock_timestamp() where id=$1",
            [category],
          ),
        ),
      "23514",
    );
    await asUser("MANAGER", (c) =>
      c.query(
        "update public.vehicles set archived_at=clock_timestamp() where id=$1",
        [vehicle],
      ),
    );
    await asUser("MANAGER", (c) =>
      c.query("update public.vehicles set archived_at=null where id=$1", [
        vehicle,
      ]),
    );
    assert.equal(
      (
        await asUser("ATTENDANT", (c) =>
          c.query("update public.vehicles set mileage=120 where id=$1", [
            vehicle,
          ]),
        )
      ).rowCount,
      0,
    );
    assert.equal(
      (
        await asUser("FINANCE", (c) =>
          c.query("select * from public.vehicles where id=$1", [vehicle]),
        )
      ).rowCount,
      0,
    );
  });
  await test("clientes PF/PJ, CPF/CNPJ, endereço brasileiro e proteção de duplicidade", async () => {
    customer = (
      await asUser(
        "ATTENDANT",
        async (c) =>
          (
            await c.query(
              "insert into public.customers(person_type,name,tax_document,email,phone,address) values('PF','Cliente F4','11144477735','f4@example.invalid','85988887777',$1) returning id",
              [address],
            )
          ).rows[0],
      )
    ).id;
    await asUser("ATTENDANT", (c) =>
      c.query(
        "update public.customers set name='Cliente atualizado' where id=$1",
        [customer],
      ),
    );
    await errorCode(
      () =>
        asUser("ATTENDANT", (c) =>
          c.query(
            "update public.customers set tax_document='11111111111' where id=$1",
            [customer],
          ),
        ),
      "23514",
    );
    await errorCode(
      () =>
        asUser("ATTENDANT", (c) =>
          c.query(
            "update public.customers set tax_document='52998224725' where id=$1",
            [customer],
          ),
        ),
      "23505",
    );
    await errorCode(
      () =>
        asUser("ATTENDANT", (c) =>
          c.query("update public.customers set address='{}' where id=$1", [
            customer,
          ]),
        ),
      "23514",
    );
    await errorCode(
      () =>
        asUser("ATTENDANT", (c) =>
          c.query(
            "update public.customers set birth_date='2200-01-01' where id=$1",
            [customer],
          ),
        ),
      "23514",
    );
    await asUser("ATTENDANT", (c) =>
      c.query(
        "insert into public.customers(person_type,name,tax_document,email,phone,address) values('PJ','Empresa F4','12ABC34501DE35','pj@example.invalid','8533334444',$1)",
        [address],
      ),
    );
    assert.equal(
      (
        await asUser("FINANCE", (c) =>
          c.query("select * from public.customers where id=$1", [customer]),
        )
      ).rowCount,
      0,
    );
  });
  await test("condutores, vínculo com cliente, CNH e arquivamento restaurável", async () => {
    driver = (
      await asUser(
        "ATTENDANT",
        async (c) =>
          (
            await c.query(
              "insert into public.drivers(customer_id,name,cpf,license_number,license_category,license_expires_on) values($1,'Condutor F4','11144477735','12345678901','AB','2020-01-01') returning id",
              [customer],
            )
          ).rows[0],
      )
    ).id;
    await errorCode(
      () =>
        asUser("ATTENDANT", (c) =>
          c.query(
            "update public.customers set archived_at=clock_timestamp() where id=$1",
            [customer],
          ),
        ),
      "23514",
    );
    await errorCode(
      () =>
        asUser("ATTENDANT", (c) =>
          c.query(
            "update public.drivers set license_number='11111111111' where id=$1",
            [driver],
          ),
        ),
      "23514",
    );
    await asUser("ATTENDANT", (c) =>
      c.query(
        "update public.drivers set archived_at=clock_timestamp() where id=$1",
        [driver],
      ),
    );
    await asUser("ATTENDANT", (c) =>
      c.query(
        "update public.customers set archived_at=clock_timestamp() where id=$1",
        [customer],
      ),
    );
    await errorCode(
      () =>
        asUser("ATTENDANT", (c) =>
          c.query("update public.drivers set archived_at=null where id=$1", [
            driver,
          ]),
        ),
      "23514",
    );
    await asUser("ATTENDANT", (c) =>
      c.query("update public.customers set archived_at=null where id=$1", [
        customer,
      ]),
    );
    await asUser("ATTENDANT", (c) =>
      c.query("update public.drivers set archived_at=null where id=$1", [
        driver,
      ]),
    );
    assert.equal(
      (
        await asUser("ATTENDANT", (c) =>
          c.query("select * from public.drivers where id=$1", [driver]),
        )
      ).rowCount,
      1,
    );
    await errorCode(
      () =>
        asUser("ADMIN", (c) =>
          c.query("delete from public.customers where id=$1", [customer]),
        ),
      "42501",
    );
  });
  await test("edição simultânea com revisão tem exatamente um vencedor", async () => {
    const revision = (
      await db.query(
        "select updated_at::text as revision from public.vehicle_categories where id=$1",
        [category],
      )
    ).rows[0].revision;
    const results = await Promise.all(
      ["Primeiro", "Segundo"].map((description) =>
        asUser("MANAGER", (c) =>
          c.query(
            "update public.vehicle_categories set description=$3 where id=$1 and updated_at=$2 returning id",
            [category, revision, description],
          ),
        ),
      ),
    );
    assert.deepEqual(results.map((r) => r.rowCount).sort(), [0, 1]);
  });
  await test("arquivos: FKs, estado e conteúdo imutáveis; RLS por cargo e tipo", async () => {
    for (const [kind, column, owner, bucket] of [
      ["CATEGORY_IMAGE", "category_id", category, "vehicle-images"],
      ["VEHICLE_IMAGE", "vehicle_id", vehicle, "vehicle-images"],
      ["VEHICLE_DOCUMENT", "vehicle_id", vehicle, "documents"],
      ["CUSTOMER_DOCUMENT", "customer_id", customer, "documents"],
      ["DRIVER_DOCUMENT", "driver_id", driver, "documents"],
    ]) {
      const id = randomUUID(),
        path = `${owner}/${id}.jpg`;
      // Nomes de coluna são constantes desta suíte, nunca entrada de usuário.
      await db.query(
        `insert into public.registry_files(id,kind,${column},bucket,storage_path,label,media_type,byte_size,sha256,uploaded_by) values($1,$2,$3,$4,$5,'Arquivo exclusivamente de teste','image/jpeg',100,$6,$7)`,
        [id, kind, owner, bucket, path, "a".repeat(64), users.ADMIN],
      );
      await errorCode(
        () =>
          db.query(
            "update public.registry_files set status='READY' where id=$1",
            [id],
          ),
        "23514",
      );
      await errorCode(
        () =>
          asUser("ADMIN", (c) =>
            c.query(
              "insert into storage.objects(bucket_id,name) values($1,$2)",
              [bucket, path],
            ),
          ),
        "42501",
      );
      await db.query(
        "insert into storage.objects(bucket_id,name) values($1,$2)",
        [bucket, path],
      );
      assert.equal(
        (
          await asUser("ADMIN", (c) =>
            c.query(
              "select * from storage.objects where bucket_id=$1 and name=$2",
              [bucket, path],
            ),
          )
        ).rowCount,
        0,
      );
      await db.query(
        "update public.registry_files set status='READY' where id=$1",
        [id],
      );
      await errorCode(
        () =>
          db.query("update public.registry_files set sha256=$2 where id=$1", [
            id,
            "b".repeat(64),
          ]),
        "23514",
      );
      assert.equal(
        (
          await asUser("ATTENDANT", (c) =>
            c.query(
              "select * from storage.objects where bucket_id=$1 and name=$2",
              [bucket, path],
            ),
          )
        ).rowCount,
        1,
      );
      assert.equal(
        (
          await asUser("FINANCE", (c) =>
            c.query(
              "select * from storage.objects where bucket_id=$1 and name=$2",
              [bucket, path],
            ),
          )
        ).rowCount,
        kind === "CATEGORY_IMAGE" ? 1 : 0,
      );
      assert.equal(
        (
          await asUser("REVOKED", (c) =>
            c.query("select * from public.registry_files where id=$1", [id]),
          )
        ).rowCount,
        0,
      );
      await errorCode(
        () =>
          asUser("ADMIN", (c) =>
            c.query(
              "update public.registry_files set status='READY' where id=$1",
              [id],
            ),
          ),
        "42501",
      );
      await asUser("ADMIN", (c) =>
        c.query("select public.archive_registry_file($1)", [id]),
      );
      assert.equal(
        (
          await asUser("ADMIN", (c) =>
            c.query(
              "select * from storage.objects where bucket_id=$1 and name=$2",
              [bucket, path],
            ),
          )
        ).rowCount,
        0,
      );
      const audit = (
        await db.query(
          "select actor_id,safe_changes from public.audit_logs where entity_type='registry_files' and entity_id=$1 order by created_at limit 1",
          [id],
        )
      ).rows[0];
      assert.equal(audit.actor_id, users.ADMIN);
      assert.deepEqual(Object.keys(audit.safe_changes).sort(), [
        "operation",
        "status",
      ]);
      if (kind === "VEHICLE_IMAGE") {
        await asUser("ADMIN", (c) =>
          c.query(
            "insert into public.vehicle_images(vehicle_id,storage_path,alt_text) values($1,$2,'Bypass negado')",
            [vehicle, path],
          ),
        );
        assert.equal(
          (
            await asUser("ADMIN", (c) =>
              c.query(
                "select * from storage.objects where bucket_id=$1 and name=$2",
                [bucket, path],
              ),
            )
          ).rowCount,
          0,
        );
      }
    }
  });
  await test("arquivamento bloqueia compromissos e preserva histórico de uso", async () => {
    const use = await rental(db, fixture, {
      vehicle,
      start: "2030-08-01T12:00:00Z",
      end: "2030-08-03T12:00:00Z",
    });
    await errorCode(
      () =>
        asUser("MANAGER", (c) =>
          c.query(
            "update public.vehicles set archived_at=clock_timestamp() where id=$1",
            [vehicle],
          ),
        ),
      "23514",
    );
    await errorCode(
      () =>
        asUser("MANAGER", (c) =>
          c.query(
            "update public.vehicles set operational_status='RETIRED' where id=$1",
            [vehicle],
          ),
        ),
      "23514",
    );
    await db.query("begin");
    try {
      await db.query(
        "update public.rentals set status='CANCELLED' where id=$1",
        [use.id],
      );
      await db.query(
        "update public.vehicle_allocations set released_at=clock_timestamp() where rental_id=$1",
        [use.id],
      );
      await db.query("commit");
    } catch (error) {
      await db.query("rollback");
      throw error;
    }
    await asUser("MANAGER", (c) =>
      c.query(
        "update public.vehicles set archived_at=clock_timestamp() where id=$1",
        [vehicle],
      ),
    );
    assert.equal(
      (
        await asUser("MANAGER", (c) =>
          c.query("select * from public.rentals where vehicle_id=$1", [
            vehicle,
          ]),
        )
      ).rowCount,
      1,
    );
    const fileId = randomUUID();
    await errorCode(
      () =>
        db.query(
          "insert into public.registry_files(id,kind,vehicle_id,bucket,storage_path,label,media_type,byte_size,sha256,uploaded_by) values($1,'VEHICLE_IMAGE',$2,'vehicle-images',$3,'Arquivo','image/jpeg',1,$4,$5)",
          [
            fileId,
            vehicle,
            `${vehicle}/${fileId}.jpg`,
            "a".repeat(64),
            users.ADMIN,
          ],
        ),
      "23514",
    );
    await asUser("MANAGER", (c) =>
      c.query("update public.vehicles set archived_at=null where id=$1", [
        vehicle,
      ]),
    );
  });
  await test("arquivo com proprietário divergente e metadado forjado não entra", async () => {
    const id = randomUUID();
    await errorCode(
      () =>
        db.query(
          "insert into public.registry_files(id,kind,vehicle_id,bucket,storage_path,label,media_type,byte_size,sha256,uploaded_by) values($1,'VEHICLE_IMAGE',$2,'vehicle-images',$3,'Teste','image/jpeg',1,$4,$5)",
          [id, vehicle, `${customer}/${id}.jpg`, "a".repeat(64), users.ADMIN],
        ),
      "23514",
    );
    await errorCode(
      () =>
        asUser("ATTENDANT", (c) =>
          c.query(
            "insert into public.registry_files(id,kind,vehicle_id,bucket,storage_path,label,media_type,byte_size,sha256,uploaded_by) values($1,'VEHICLE_IMAGE',$2,'vehicle-images',$3,'Teste','image/jpeg',1,$4,$5)",
            [
              id,
              vehicle,
              `${vehicle}/${id}.jpg`,
              "a".repeat(64),
              users.ATTENDANT,
            ],
          ),
        ),
      "42501",
    );
  });
}
