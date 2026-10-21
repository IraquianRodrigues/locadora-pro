// Adaptadores exclusivos da prévia: nenhuma ação de escrita ou de rede.
const unavailable = async () => ({
  ok: false as const,
  message:
    "Prévia visual: esta ação não grava dados. Use a aplicação com uma sessão autorizada.",
});
export const saveRegistryAction = unavailable;
export const archiveRegistryAction = unavailable;
export const searchRegistryOptionsAction = unavailable;
export const archiveRegistryFileAction = unavailable;
export const signRegistryFileAction = unavailable;
export const uploadRegistryFileAction = unavailable;
export const publishImage = unavailable;
export const quoteAction = unavailable;
export const requestReservationAction = unavailable;
export const decisionAction = unavailable;
export const expiryAction = unavailable;
export const rentalAction = unavailable;
export const rentalJobsAction = unavailable;
export const rentalFileAction = unavailable;
export const inspectionPhotoAction = unavailable;
export const businessMutation = unavailable;
export const businessJobsAction = unavailable;
export const readNotificationAction = unavailable;
export const savePublicSite = unavailable;
export async function setStaffAccessAction(): Promise<void> {
  throw new Error("PREVIEW_READ_ONLY");
}
