import { redirect } from "next/navigation";

/** Los cupones viven dentro del dashboard, en la pestaña "Mis Cupones".
 *  Esta ruta queda solo para no romper los links que ya circulaban. */
export default function CuponesRedirect() {
  redirect("/dashboard");
}
