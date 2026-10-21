export async function GET() {
  return Response.json(
    { data: { status: "ok", service: "locadora-pro" } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
