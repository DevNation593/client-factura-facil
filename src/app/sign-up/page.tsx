import { AuthCard } from "@/components/AuthCard";

import { RegisterForm } from "./RegisterForm";

export default function RegistroPage() {
  return (
    <AuthCard title="Crear una cuenta" lead="Con su cuenta podrá crear su empresa y empezar a facturar.">
      <RegisterForm />
    </AuthCard>
  );
}
