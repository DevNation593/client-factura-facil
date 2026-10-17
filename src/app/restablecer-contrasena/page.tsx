import { AuthCard } from "@/components/AuthCard";

import { ResetPasswordForm } from "./ResetPasswordForm";

export default function RestablecerContrasenaPage() {
  return (
    <AuthCard title="Elegir una contraseña nueva">
      <ResetPasswordForm />
    </AuthCard>
  );
}
