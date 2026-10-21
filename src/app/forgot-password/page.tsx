import { AuthCard } from "@/components/AuthCard";

import { ForgotPasswordForm } from "./ForgotPasswordForm";

export default function OlvideContrasenaPage() {
  return (
    <AuthCard title="Olvidé mi contraseña" lead="Le enviaremos un enlace para elegir una nueva.">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
