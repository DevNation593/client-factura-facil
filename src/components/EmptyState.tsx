import type { ReactNode } from "react";

import { Icon, type IconName } from "./Icon";

/** Lo que todavía no hay: un icono de lo que falta, qué falta y, si se puede, cómo empezar. */
export function EmptyState({ icon, action, children }: { icon: IconName; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={22} />
      </span>
      <p>{children}</p>
      {action ? <div className="actions">{action}</div> : null}
    </div>
  );
}
