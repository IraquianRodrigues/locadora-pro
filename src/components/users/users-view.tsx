import Link from "next/link";
import {
  WorkspaceHeading,
  RecordStatus,
  EmptyRecords,
} from "@/components/business/workspace";
import { AccessForm } from "./access-form";
import { roleLabels, type StaffRole } from "./roles";
export type TeamProfile = {
  id: string;
  display_name: string;
  active: boolean;
  role?: StaffRole;
};
export function UsersView({
  profiles,
  cursor,
  hasNext,
  result,
  action,
}: {
  profiles: TeamProfile[];
  cursor?: string;
  hasNext: boolean;
  result?: string;
  action: (form: FormData) => Promise<void>;
}) {
  return (
    <div className="administration-workspace">
      <WorkspaceHeading
        title="Acessos da equipe"
        description="Consulte a situação de cada funcionário e ajuste o cargo ou a liberação de acesso."
      />
      <p className="business-context-note">
        Esta lista reúne funcionários já cadastrados no Supabase Auth. A criação
        da conta ocorre no ambiente de autenticação.
      </p>
      {result === "ok" && (
        <p role="status" className="business-feedback">
          Acesso atualizado.
        </p>
      )}
      {result === "erro" && (
        <p role="alert" className="business-feedback">
          Não foi possível alterar o acesso. Confira a conexão, suas permissões
          e a existência de outro administrador ativo.
        </p>
      )}
      {profiles.length ? (
        <>
          <p className="records-count">
            {profiles.length} funcionário(s) nesta página
          </p>
          <ul className="team-list">
            {profiles.map((profile) => (
              <li key={profile.id} className="team-entry">
                <div className="administration-row-heading">
                  <div>
                    <h2>{profile.display_name}</h2>
                    <p>
                      {profile.role ? roleLabels[profile.role] : "Sem cargo"}
                    </p>
                  </div>
                  <RecordStatus attention={!profile.active}>
                    {profile.active ? "Ativo" : "Inativo"}
                  </RecordStatus>
                </div>
                <details className="business-disclosure">
                  <summary>Editar acesso de {profile.display_name}</summary>
                  <AccessForm
                    id={profile.id}
                    name={profile.display_name}
                    role={profile.role}
                    active={profile.active}
                    action={action}
                  />
                </details>
                <details className="business-references">
                  <summary>Identificador do funcionário</summary>
                  <p>{profile.id}</p>
                </details>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyRecords title="Nenhum funcionário encontrado">
          Cadastre a conta no Supabase Auth para que o perfil possa receber um
          cargo e acesso ao painel.
        </EmptyRecords>
      )}
      <nav
        aria-label="Paginação de funcionários"
        className="records-pagination"
      >
        <span>Até 20 funcionários por página</span>
        <div>
          {cursor && (
            <Link href="/admin/usuarios">Voltar à primeira página</Link>
          )}
          {hasNext && profiles.length > 0 && (
            <Link
              href={`/admin/usuarios?depois=${profiles[profiles.length - 1].id}`}
            >
              Próxima página
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
