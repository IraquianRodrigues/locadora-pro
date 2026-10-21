import { randomUUID } from "node:crypto";

export const users = Object.fromEntries(
  ["ADMIN", "MANAGER", "ATTENDANT", "FINANCE", "REVOKED", "UNASSIGNED"].map(
    (role) => [role, randomUUID()],
  ),
);
export const sessions = Object.fromEntries(
  Object.keys(users).map((role) => [role, randomUUID()]),
);

export async function seedFixtures(db) {
  await db.query("begin");
  try {
    for (const [role, id] of Object.entries(users)) {
      await db.query("insert into auth.users(id) values($1)", [id]);
      await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
        sessions[role],
        id,
      ]);
      await db.query("update public.profiles set active=$2 where id=$1", [
        id,
        role !== "REVOKED",
      ]);
      if (!["REVOKED", "UNASSIGNED"].includes(role)) {
        await db.query(
          "insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code=$2",
          [id, role],
        );
      }
    }
    const branch = (
      await db.query(
        `insert into public.branches(name,address) values('Unidade de teste', '{"postal_code":"60000000","street":"Rua de teste","number":"1","district":"Centro","city":"Fortaleza","state":"CE"}') returning id`,
      )
    ).rows[0].id;
    const category = (
      await db.query(
        "insert into public.vehicle_categories(name,capacity) values('Categoria de teste',5) returning id",
      )
    ).rows[0].id;
    const vehicles = [];
    for (const plate of ["TST1A01", "TST1A02", "TST1A03"]) {
      vehicles.push(
        (
          await db.query(
            `insert into public.vehicles(category_id,branch_id,plate,make,model,manufacture_year,model_year,color,fuel,transmission,passengers,doors)
        values($1,$2,$3,'Teste','Veículo',2025,2025,'Branco','FLEX','MANUAL',5,4) returning id`,
            [category, branch, plate],
          )
        ).rows[0].id,
      );
    }
    const customer = (
      await db.query(`insert into public.customers(person_type,name,tax_document,email,phone,address)
      values('PF','Cliente exclusivamente de teste','52998224725','teste@example.invalid','85999999999','{"postal_code":"60000000","street":"Rua de teste","number":"1","district":"Centro","city":"Fortaleza","state":"CE"}') returning id`)
    ).rows[0].id;
    const plan = (
      await db.query(
        "insert into public.rate_plans(name,period_unit,policy) values('Plano teste','DAY','{}') returning id",
      )
    ).rows[0].id;
    const method = (
      await db.query(
        "insert into public.payment_methods(name) values('Método de teste') returning id",
      )
    ).rows[0].id;
    await db.query(
      "insert into public.system_settings(key,value) values('public_site',$1)",
      [
        {
          enabled: true,
          name: "Apenas testes",
          email: "test@example.invalid",
          phone: "85999999999",
          address: "Endereço exclusivamente de teste",
          terms:
            "Condições fictícias exclusivamente para testes automatizados.",
          privacy:
            "Política fictícia exclusivamente para testes automatizados.",
          terms_version: randomUUID(),
        },
      ],
    );
    await db.query("commit");
    return { branch, category, vehicles, customer, plan, method };
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}

export async function quote(
  db,
  fixture,
  start = "2030-01-01T12:00:00Z",
  end = "2030-01-03T12:00:00Z",
  total = "200.00",
) {
  const id = (
    await db.query(
      `insert into public.quotes(customer_id,rate_plan_id,start_at,end_at,expires_at,total,rules_snapshot)
    values($1,$2,$3,$4,'2031-01-01T00:00:00Z',$5,'{}') returning id`,
      [fixture.customer, fixture.plan, start, end, total],
    )
  ).rows[0].id;
  await db.query(
    "insert into public.quote_items(quote_id,kind,description,quantity,unit_amount,total,snapshot) values($1,'RENTAL','Teste',1,$2,$2,'{}')",
    [id, total],
  );
  await db.query(
    "update public.quotes set locked_at=clock_timestamp() where id=$1",
    [id],
  );
  return id;
}

export async function reservation(
  db,
  fixture,
  {
    vehicle = fixture.vehicles[0],
    category = null,
    start = "2030-01-01T12:00:00Z",
    end = "2030-01-03T12:00:00Z",
  } = {},
) {
  await db.query("begin");
  try {
    const quoteId = await quote(db, fixture, start, end);
    const id = (
      await db.query(
        `insert into public.reservations(customer_id,branch_id,quote_id,start_at,end_at,lookup_token_hash,lookup_expires_at)
      values($1,$2,$3,$4,$5,$6,'2031-01-01T00:00:00Z') returning id`,
        [
          fixture.customer,
          fixture.branch,
          quoteId,
          start,
          end,
          randomUUID().replaceAll("-", "").repeat(2),
        ],
      )
    ).rows[0].id;
    await db.query(
      "insert into public.reservation_items(reservation_id,category_id,vehicle_id) values($1,$2,$3)",
      [id, category, category ? null : vehicle],
    );
    await db.query("commit");
    return { id, quoteId, start, end };
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}

export async function rental(
  db,
  fixture,
  {
    vehicle = fixture.vehicles[2],
    start = "2030-03-01T12:00:00Z",
    end = "2030-03-03T12:00:00Z",
  } = {},
) {
  await db.query("begin");
  try {
    const quoteId = await quote(db, fixture, start, end);
    const id = (
      await db.query(
        `insert into public.rentals(customer_id,vehicle_id,branch_id,quote_id,responsible_id,start_at,end_at,commercial_snapshot)
      values($1,$2,$3,$4,$5,$6,$7,'{"total":"200.00"}') returning id`,
        [
          fixture.customer,
          vehicle,
          fixture.branch,
          quoteId,
          users.MANAGER,
          start,
          end,
        ],
      )
    ).rows[0].id;
    await db.query(
      "insert into public.vehicle_allocations(vehicle_id,period,kind,rental_id,created_by) values($1,tstzrange($2,$3,'[)'),'RENTAL',$4,$5)",
      [vehicle, start, end, id, users.MANAGER],
    );
    await db.query("commit");
    return { id, quoteId, start, end };
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}
