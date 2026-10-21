import { Button } from "@/components/ui/button";
export function PeriodForm({
  from,
  to,
  children,
}: {
  from: string;
  to: string;
  children?: React.ReactNode;
}) {
  return (
    <form method="get" className="period-form">
      <label>
        De
        <input type="date" name="from" required defaultValue={from} />
      </label>
      <label>
        Até (inclusive)
        <input type="date" name="to" required defaultValue={to} />
      </label>
      {children}
      <Button type="submit" variant="outline">
        Atualizar período
      </Button>
    </form>
  );
}
