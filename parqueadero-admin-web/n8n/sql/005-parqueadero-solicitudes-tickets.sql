-- Extiende los pagos existentes como solicitudes de tickets sin romper la relación pago/autorización.
BEGIN;

ALTER TABLE public.parqueadero_pagos
  ADD COLUMN IF NOT EXISTS origen_solicitud varchar(20) NOT NULL DEFAULT 'PANEL',
  ADD COLUMN IF NOT EXISTS motivo_rechazo varchar(300);

ALTER TABLE public.parqueadero_pagos DROP CONSTRAINT IF EXISTS parqueadero_pagos_origen_solicitud_check;
ALTER TABLE public.parqueadero_pagos ADD CONSTRAINT parqueadero_pagos_origen_solicitud_check
  CHECK (origen_solicitud IN ('PANEL', 'YAVIBOT'));

COMMIT;
