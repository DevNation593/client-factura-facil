// Generado desde contracts/openapi.yaml con `npm run api:generate`. No editar a mano.

export interface paths {
    "/tenants": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Empresas en las que el usuario tiene una membresía activa. */
        get: operations["listTenants"];
        put?: never;
        /** Crea una empresa; quien la crea queda como OWNER. */
        post: operations["createTenant"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/tenants/current": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Empresa activa de la petición y rol del usuario en ella. */
        get: operations["getCurrentTenant"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/members": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Miembros de la empresa activa, el más antiguo primero. Requiere rol OWNER o ADMIN. */
        get: operations["listMembers"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/members/{userId}/role": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Cambia el rol de un miembro. Solo el OWNER; su propio rol no se cambia. */
        put: operations["changeMemberRole"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/members/{userId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Retira a un miembro de la empresa; pierde el acceso en su siguiente petición. El OWNER retira a cualquiera salvo a sí mismo; un ADMIN, solo a BILLER y AUDITOR (si no, 403 ROLE_NOT_GRANTABLE). */
        delete: operations["removeMember"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/invitations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Invitaciones pendientes y vigentes de la empresa, sin su código. Requiere OWNER o ADMIN. */
        get: operations["listInvitations"];
        put?: never;
        /** Invita a un correo a la empresa con un rol. Requiere OWNER o ADMIN, y nadie concede un rol igual o superior al suyo (403 ROLE_NOT_GRANTABLE). La respuesta trae el código de la invitación: es la única vez que se muestra. Invitar de nuevo al mismo correo anula la anterior (queda como revocada en la auditoría), salvo que quien invita no pudiera revocarla: entonces 403 ROLE_NOT_GRANTABLE y la anterior sigue en pie. */
        post: operations["createInvitation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/invitations/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Anula una invitación pendiente; su enlace deja de valer. */
        delete: operations["revokeInvitation"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/invitations/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Qué empresa y qué rol ofrece un código de invitación. Con sesión, sin empresa activa. Mismas respuestas de error que al aceptar. */
        post: operations["previewInvitation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/invitations/accept": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Acepta una invitación: quien inició sesión pasa a ser miembro de esa empresa con el rol ofrecido. Su token debe traer el correo invitado. Con sesión, sin empresa activa. */
        post: operations["acceptInvitation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/taxpayers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Emisores de la empresa activa. */
        get: operations["listTaxpayers"];
        put?: never;
        /** Da de alta un emisor. Requiere rol OWNER o ADMIN. */
        post: operations["createTaxpayer"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/taxpayers/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Un emisor de la empresa activa. */
        get: operations["getTaxpayer"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/taxpayers/{id}/production-readiness": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Qué tiene y qué le falta al emisor para pasar a producción. */
        get: operations["getProductionReadiness"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/taxpayers/{id}/production-activation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Pasa el emisor a producción. Requiere rol OWNER, un certificado vigente, al menos un comprobante autorizado por el SRI en el ambiente de pruebas y la declaración de que el SRI habilitó el RUC para producción. Repetirla no cambia nada. */
        post: operations["activateProduction"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/taxpayers/{taxpayerId}/establishments": {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path: {
                taxpayerId: string;
            };
            cookie?: never;
        };
        /** Establecimientos del emisor, ordenados por código. */
        get: operations["listEstablishments"];
        put?: never;
        /** Crea un establecimiento del emisor. Requiere rol OWNER o ADMIN. */
        post: operations["createEstablishment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/emission-points": {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path?: never;
            cookie?: never;
        };
        /** Puntos de emisión de un establecimiento, ordenados por código. */
        get: operations["listEmissionPoints"];
        put?: never;
        /** Crea un punto de emisión en un establecimiento. Requiere rol OWNER o ADMIN. */
        post: operations["createEmissionPoint"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/catalogs/identification-types": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Tipos de identificación del comprador (ficha técnica, tabla 6). */
        get: operations["listIdentificationTypes"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/catalogs/payment-methods": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Formas de pago con su vigencia (ficha técnica, tabla 24). */
        get: operations["listPaymentMethods"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/catalogs/tax-rates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Tarifas de impuesto por código (ficha técnica, tablas 16 y 17). */
        get: operations["listTaxRates"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/customers": {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path?: never;
            cookie?: never;
        };
        /** Clientes de la empresa activa, paginados; q busca por nombre o prefijo de identificación. */
        get: operations["listCustomers"];
        put?: never;
        /** Registra un cliente. Requiere rol OWNER, ADMIN o BILLER. */
        post: operations["createCustomer"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/customers/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Un cliente de la empresa activa. */
        get: operations["getCustomer"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/products": {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path?: never;
            cookie?: never;
        };
        /** Productos de la empresa activa, paginados; q busca en nombre o código. */
        get: operations["listProducts"];
        put?: never;
        /** Registra un producto o servicio. Requiere rol OWNER o ADMIN. */
        post: operations["createProduct"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/products/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Un producto de la empresa activa. */
        get: operations["getProduct"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/emission-points/{id}/sequence": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Fija el próximo secuencial de un punto de emisión que aún no ha emitido comprobantes de ese tipo y ambiente. Requiere rol OWNER o ADMIN. */
        put: operations["setEmissionPointSequence"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/invoices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Emite una factura: la calcula, le asigna secuencial y clave de acceso y la deja en RESERVED. 202 significa aceptada para procesamiento, no autorizada por el SRI. Requiere rol OWNER, ADMIN o BILLER. */
        post: operations["issueInvoice"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/documents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Comprobantes de la empresa activa, del más reciente al más antiguo. */
        get: operations["listDocuments"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/documents/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Un comprobante con su estado actual, totales, líneas y pagos. */
        get: operations["getDocument"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/documents/{id}/artifacts/{kind}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Descarga un artefacto del comprobante, como adjunto con el número del comprobante en el nombre. La cabecera ETag lleva su SHA-256. */
        get: operations["downloadDocumentArtifact"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/documents/{id}/deliveries": {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        /** Entregas del comprobante al receptor, la más reciente primero. */
        get: operations["listDocumentDeliveries"];
        put?: never;
        /** Pide un nuevo envío del comprobante autorizado por correo, con el RIDE y el XML autorizado adjuntos, a la dirección del cliente o a la indicada. El envío es asíncrono. Requiere rol OWNER, ADMIN o BILLER. */
        post: operations["requestDocumentDelivery"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/documents/{id}/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Devuelve a la cola un comprobante que quedó a medio camino (sin firmar por falta de certificado, o sin respuesta definitiva del SRI). No cambia su estado: el procesamiento lo retoma donde está. Requiere rol OWNER, ADMIN o BILLER. */
        post: operations["retryDocument"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/documents/{id}/sri-attempts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Llamadas al SRI hechas para el comprobante, la más reciente primero, con sus mensajes. */
        get: operations["listDocumentSriAttempts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/certificates": {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path?: never;
            cookie?: never;
        };
        /** Metadatos de los certificados de un emisor, el más reciente primero. */
        get: operations["listCertificates"];
        put?: never;
        /** Carga el certificado de firma (.p12) de un emisor y lo deja como el activo. Se guarda cifrado y nunca se devuelve. Requiere rol OWNER o ADMIN. */
        post: operations["uploadCertificate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhooks/subscriptions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Suscripciones de la empresa, sin su secreto. Requiere OWNER o ADMIN. */
        get: operations["listWebhookSubscriptions"];
        put?: never;
        /** Registra una dirección a la que avisar de lo que pasa con los comprobantes de la empresa. Requiere OWNER o ADMIN. La respuesta trae el secreto con que se firman los avisos: es la única vez que se muestra. La dirección debe ser https y de un servidor público de internet (422 WEBHOOK_URL_NOT_ALLOWED). Hasta 10 por empresa. */
        post: operations["createWebhookSubscription"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhooks/subscriptions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Cambia la dirección, los eventos o la descripción, y la apaga o la vuelve a encender. Encenderla pone a cero su cuenta de fallos (409 WEBHOOKS_DISABLED si la instalación no tiene habilitados los avisos). */
        put: operations["updateWebhookSubscription"];
        post?: never;
        /** Borra la suscripción y su historial de avisos. */
        delete: operations["deleteWebhookSubscription"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhooks/subscriptions/{id}/deliveries": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Avisos de la suscripción, los más recientes primero: qué se envió, qué espera un reintento y qué falló, con el código que respondió el receptor. Requiere OWNER o ADMIN. */
        get: operations["listWebhookDeliveries"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhooks/deliveries/{id}/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Vuelve a poner en marcha un aviso que agotó sus intentos. Sale en segundos, con el mismo identificador de evento. Requiere OWNER o ADMIN. */
        post: operations["retryWebhookDelivery"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhooks/subscriptions/{id}/secret": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cambia el secreto de firma y devuelve el nuevo: es la única vez que se muestra. Durante 24 horas los avisos llevan dos firmas, la del secreto nuevo y la del anterior. */
        post: operations["rotateWebhookSecret"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        Problem: {
            type?: string;
            title?: string;
            status: number;
            detail?: string;
            instance?: string;
            /** @enum {string} */
            errorCode: "UNAUTHENTICATED" | "FORBIDDEN" | "TENANT_REQUIRED" | "TENANT_HEADER_INVALID" | "TENANT_FORBIDDEN" | "ROLE_FORBIDDEN" | "NOT_FOUND" | "VALIDATION_FAILED" | "MALFORMED_REQUEST" | "METHOD_NOT_ALLOWED" | "UNSUPPORTED_MEDIA_TYPE" | "REQUEST_REJECTED" | "RUC_ALREADY_REGISTERED" | "ESTABLISHMENT_CODE_TAKEN" | "EMISSION_POINT_CODE_TAKEN" | "IDENTIFICATION_TYPE_UNKNOWN" | "IDENTIFICATION_INVALID" | "CUSTOMER_ALREADY_EXISTS" | "TAX_RATE_UNKNOWN" | "PRODUCT_SKU_TAKEN" | "SEQUENCE_ALREADY_USED" | "IDEMPOTENCY_KEY_REQUIRED" | "IDEMPOTENCY_KEY_INVALID" | "IDEMPOTENCY_KEY_REUSED" | "UNSUPPORTED_CURRENCY" | "INVALID_ISSUE_DATE" | "EMISSION_POINT_DISABLED" | "INVALID_LINE" | "AMOUNT_TOO_LARGE" | "INVALID_PAYMENT" | "CERTIFICATE_UNREADABLE" | "CERTIFICATE_NO_PRIVATE_KEY" | "CERTIFICATE_AMBIGUOUS" | "CERTIFICATE_EXPIRED" | "CERTIFICATE_NOT_YET_VALID" | "CERTIFICATE_KEY_UNSUPPORTED" | "CERTIFICATE_KEY_MISMATCH" | "DOCUMENT_NOT_RETRYABLE" | "DOCUMENT_NOT_AUTHORIZED" | "DELIVERY_DISABLED" | "DELIVERY_LIMIT_REACHED" | "DELIVERY_RECIPIENT_MISSING" | "RIMPE_REGIME_UNSUPPORTED" | "PRODUCTION_NOT_ENABLED" | "RATE_LIMITED" | "REPLACED_DOCUMENT_NOT_REJECTED" | "WEBHOOKS_DISABLED" | "WEBHOOK_URL_NOT_ALLOWED" | "WEBHOOK_LIMIT_REACHED" | "WEBHOOK_DELIVERY_NOT_RETRYABLE" | "WEBHOOK_SUBSCRIPTION_DISABLED" | "REPLACED_DOCUMENT_OTHER_ISSUER" | "DOCUMENT_ALREADY_REPLACED" | "INVITATION_NOT_VALID" | "INVITATION_EMAIL_MISMATCH" | "EMAIL_NOT_VERIFIED" | "ALREADY_MEMBER" | "ROLE_NOT_GRANTABLE" | "OWNER_PROTECTED" | "INVITATION_LIMIT_REACHED" | "PRODUCTION_REQUIREMENTS_NOT_MET" | "PAYMENT_METHOD_UNKNOWN" | "PAYMENTS_MISMATCH" | "FINAL_CONSUMER_LIMIT_EXCEEDED" | "SEQUENCE_EXHAUSTED" | "INTERNAL_ERROR";
            correlationId: string;
            /** @description Solo con VALIDATION_FAILED. */
            errors?: {
                field?: string;
                message?: string;
            }[];
        };
        CodeName: {
            code: string;
            name: string;
        };
        PaymentMethod: {
            code: string;
            name: string;
            /** Format: date */
            validFrom: string;
            /** Format: date */
            validTo?: string | null;
        };
        /** @description Importe o cantidad como cadena decimal, para no perder precisión. */
        Decimal: string;
        TaxRate: {
            /** @description Impuesto: 2 es IVA. */
            taxCode: string;
            rateCode: string;
            description: string;
            rate: components["schemas"]["Decimal"];
        };
        CreateCustomerRequest: {
            /** @description Código de la tabla 6 de la ficha: 04, 05, 06, 07 u 08. */
            idType: string;
            idNumber: string;
            name: string;
            /** Format: email */
            email?: string | null;
            address?: string | null;
            phone?: string | null;
        };
        Customer: {
            /** Format: uuid */
            id: string;
            idType: string;
            idNumber: string;
            name: string;
            email?: string | null;
            address?: string | null;
            phone?: string | null;
        };
        CreateProductRequest: {
            sku: string;
            name: string;
            /** @description Hasta 12 enteros y 6 decimales. */
            unitPrice: components["schemas"]["Decimal"];
            /** @description Código de tarifa de IVA del catálogo (ficha, tabla 17). */
            ivaRateCode: string;
        };
        Product: {
            /** Format: uuid */
            id: string;
            sku: string;
            name: string;
            unitPrice: components["schemas"]["Decimal"];
            ivaRateCode: string;
        };
        SetSequenceRequest: {
            /** @enum {string} */
            environment: "1" | "2";
            /** @enum {string} */
            documentType: "01";
            nextValue: number;
        };
        Sequence: {
            /** Format: uuid */
            emissionPointId: string;
            environment: string;
            documentType: string;
            nextValue: number;
        };
        IssueInvoiceRequest: {
            /** Format: uuid */
            taxpayerId: string;
            /** @description Tres dígitos. */
            establishmentCode: string;
            /** @description Tres dígitos. */
            emissionPointCode: string;
            /** Format: uuid */
            customerId: string;
            /**
             * Format: date
             * @description Por defecto hoy en Ecuador. No puede ser futura ni anterior al último comprobante del punto.
             */
            issueDate?: string | null;
            /** @description Solo USD, que es el valor por defecto. */
            currency?: string | null;
            lines: {
                /** Format: uuid */
                productId: string;
                quantity: components["schemas"]["Decimal"];
                /** @description Por defecto, el precio del producto. Hasta 6 decimales. */
                unitPrice?: string | null;
                /** @description Por defecto 0.00. Hasta 2 decimales. */
                discount?: string | null;
            }[];
            /** @description Su suma debe ser igual al total que calcula el servidor. */
            payments: {
                /** @description Forma de pago del catálogo (ficha, tabla 24). */
                methodCode: string;
                amount: components["schemas"]["Decimal"];
            }[];
            /**
             * Format: uuid
             * @description Comprobante de la misma empresa y del mismo emisor, en estado RETURNED, NOT_AUTHORIZED o XSD_INVALID, al que esta factura reemplaza. La nueva lleva su propio secuencial y su propia clave; el reemplazado no cambia. 409 REPLACED_DOCUMENT_NOT_REJECTED si está en otro estado, 409 REPLACED_DOCUMENT_OTHER_ISSUER si es de otro emisor y 409 DOCUMENT_ALREADY_REPLACED si ya tiene reemplazo.
             */
            replacesDocumentId?: string | null;
        };
        IssuedDocument: {
            /** Format: uuid */
            id: string;
            /** @description Estado actual del documento. RESERVED al emitir; en un reintento puede haber avanzado. */
            state: string;
            statusUrl: string;
        };
        DocumentSummary: {
            /** Format: uuid */
            id: string;
            documentType: string;
            state: components["schemas"]["DocumentState"];
            /** @description establecimiento-punto-secuencial, por ejemplo 001-002-000000123. */
            number: string;
            /** Format: date */
            issueDate: string;
            customerName: string;
            total: components["schemas"]["Decimal"];
        };
        /**
         * @description Estado interno del comprobante. RESERVED (secuencial y clave asignados), GENERATED (XML válido), SIGNED (firmado; aquí espera si la transmisión del ambiente no está habilitada), SENDING (envío en curso o de resultado incierto), RECEIVED (el SRI lo recibió; pendiente de autorización), AUTHORIZED. Estados de fallo: XSD_INVALID, SIGNATURE_FAILED, RETURNED (la recepción lo devolvió) y NOT_AUTHORIZED.
         * @enum {string}
         */
        DocumentState: "RESERVED" | "GENERATED" | "SIGNED" | "SENDING" | "RECEIVED" | "AUTHORIZED" | "XSD_INVALID" | "SIGNATURE_FAILED" | "RETURNED" | "NOT_AUTHORIZED";
        DocumentRetryAccepted: {
            /** Format: uuid */
            id: string;
            state: components["schemas"]["DocumentState"];
        };
        DeliveryRequest: {
            /**
             * Format: email
             * @description Dirección a la que enviar; si falta, la del cliente que consta en el comprobante.
             */
            email?: string | null;
        };
        Delivery: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            channel: "EMAIL";
            recipient: string;
            /**
             * @description PENDING (por enviar o esperando un reintento), SENDING (envío en curso), SENT (el servidor de correo lo aceptó; no implica que el receptor lo haya leído ni que no rebote después) o FAILED (rechazo definitivo o reintentos agotados). No afecta al estado fiscal del comprobante.
             * @enum {string}
             */
            status: "PENDING" | "SENDING" | "SENT" | "FAILED";
            attemptCount: number;
            /** @description Motivo del último fallo, si lo hubo. */
            lastError?: string | null;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            sentAt?: string | null;
            /** @description true si es la entrega que se crea sola al autorizarse el comprobante; false si la pidió un usuario. */
            automatic: boolean;
        };
        /** @description Error o advertencia que devolvió el SRI, tal como llegó. */
        SriMessage: {
            /** @description Código del catálogo de la ficha técnica. */
            identifier?: string | null;
            message?: string | null;
            additionalInfo?: string | null;
            /** @description ERROR */
            type?: string | null;
        };
        SriAttempt: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            operation: "RECEPTION" | "AUTHORIZATION";
            /** @description Cómo se interpretó el intento; nulo mientras está en curso. Recepción: RECEIVED, ALREADY_REGISTERED (el SRI ya tenía la clave), RETURNED, UNCERTAIN (sin respuesta válida) o ABANDONED. Autorización: AUTHORIZED, NOT_AUTHORIZED, PROCESSING, NOT_FOUND, MISMATCH (la respuesta era de otra clave o de otro ambiente) o UNCERTAIN. */
            outcome?: string | null;
            /** @description Estado literal devuelto por el SRI. */
            sriStatus?: string | null;
            httpStatus?: number | null;
            /** Format: date-time */
            startedAt: string;
            /** Format: date-time */
            completedAt?: string | null;
            messages: components["schemas"]["SriMessage"][];
        };
        Document: {
            /** Format: uuid */
            id: string;
            documentType: string;
            state: components["schemas"]["DocumentState"];
            /** @enum {string} */
            environment: "1" | "2";
            /** Format: uuid */
            taxpayerId: string;
            number: string;
            /** @description Nueve dígitos. */
            sequence: string;
            /** @description Número de autorización del SRI; nulo hasta que el comprobante está AUTHORIZED. */
            authorizationNumber?: string | null;
            /**
             * Format: date-time
             * @description Fecha y hora de autorización que devolvió el SRI, en UTC.
             */
            authorizedAt?: string | null;
            /**
             * Format: uuid
             * @description Cliente del catálogo al que se emitió.
             */
            customerId?: string;
            /**
             * Format: uuid
             * @description Comprobante rechazado al que este reemplaza.
             */
            replacesDocumentId?: string | null;
            /**
             * Format: uuid
             * @description Comprobante que reemplazó a este, si fue rechazado y se emitió de nuevo.
             */
            replacedByDocumentId?: string | null;
            /** @description Clave de acceso de 49 dígitos. */
            accessKey: string;
            /** Format: date */
            issueDate: string;
            currency: string;
            customer: {
                idType: string;
                idNumber: string;
                name: string;
            };
            subtotal: components["schemas"]["Decimal"];
            totalDiscount: components["schemas"]["Decimal"];
            taxes: {
                taxCode: string;
                rateCode: string;
                rate: components["schemas"]["Decimal"];
                base: components["schemas"]["Decimal"];
                amount: components["schemas"]["Decimal"];
            }[];
            totalTax: components["schemas"]["Decimal"];
            total: components["schemas"]["Decimal"];
            lines: {
                lineNo: number;
                /**
                 * Format: uuid
                 * @description Producto del catálogo del que salió la línea.
                 */
                productId?: string | null;
                mainCode: string;
                description: string;
                quantity: components["schemas"]["Decimal"];
                unitPrice: components["schemas"]["Decimal"];
                discount: components["schemas"]["Decimal"];
                subtotal: components["schemas"]["Decimal"];
                taxCode: string;
                taxRateCode: string;
                taxRate: components["schemas"]["Decimal"];
                taxAmount: components["schemas"]["Decimal"];
            }[];
            payments: {
                methodCode: string;
                amount: components["schemas"]["Decimal"];
            }[];
        };
        UploadCertificateRequest: {
            /** Format: uuid */
            taxpayerId: string;
            /**
             * Format: byte
             * @description Archivo PKCS#12 en Base64; hasta unos 64 KB de archivo.
             */
            p12: string;
            /** Format: password */
            password: string;
        };
        Certificate: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            taxpayerId: string;
            subject: string;
            issuer: string;
            serialNumber: string;
            fingerprintSha256: string;
            /** Format: date-time */
            validFrom: string;
            /** Format: date-time */
            validTo: string;
            /** @enum {string} */
            status: "ACTIVE" | "REPLACED";
        };
        /** @enum {string} */
        Role: "OWNER" | "ADMIN" | "BILLER" | "AUDITOR";
        CreateTenantRequest: {
            name: string;
        };
        Tenant: {
            /** Format: uuid */
            id: string;
            name: string;
            /** @enum {string} */
            status: "ACTIVE" | "SUSPENDED";
            role: components["schemas"]["Role"];
        };
        Member: {
            /** Format: uuid */
            userId: string;
            /** @description Correo con el que el proveedor de identidad conoce a la persona, si lo informa. */
            email?: string | null;
            role: components["schemas"]["Role"];
            /** Format: date-time */
            since: string;
            /** @description Si es quien hace la consulta. */
            self: boolean;
        };
        Invitation: {
            /** Format: uuid */
            id: string;
            email: string;
            role: components["schemas"]["Role"];
            /** Format: date-time */
            expiresAt: string;
            /** @description Correo de quien la creó. */
            invitedBy?: string | null;
        };
        /**
         * @description document.received: el SRI recibió el comprobante. document.authorized: lo autorizó. document.rejected: lo devolvió o no lo autorizó (el campo state del aviso dice cuál). document.delivered: salió un correo de entrega al cliente.
         * @enum {string}
         */
        WebhookEventType: "document.received" | "document.authorized" | "document.rejected" | "document.delivered";
        WebhookSubscriptionInput: {
            /** @description Dirección https de un servidor público. */
            url: string;
            eventTypes: components["schemas"]["WebhookEventType"][];
            description?: string | null;
        };
        WebhookSubscription: {
            /** Format: uuid */
            id: string;
            url: string;
            eventTypes: components["schemas"]["WebhookEventType"][];
            description?: string | null;
            /** @enum {string} */
            status: "ACTIVE" | "DISABLED";
            /**
             * @description MANUAL si la apagó la empresa; TOO_MANY_FAILURES si se apagó sola tras fallar muchas veces seguidas.
             * @enum {string|null}
             */
            disabledReason?: "MANUAL" | "TOO_MANY_FAILURES" | null;
            /** @description Intentos fallidos seguidos; un envío correcto lo pone a cero. */
            consecutiveFailures: number;
            /** Format: date-time */
            createdAt: string;
            /**
             * Format: date-time
             * @description Hasta cuándo sigue firmando el secreto anterior, si se rotó hace poco.
             */
            previousSecretExpiresAt?: string | null;
        };
        WebhookDelivery: {
            /** Format: uuid */
            id: string;
            /**
             * Format: uuid
             * @description El webhook-id con que viaja el aviso.
             */
            eventId: string;
            eventType: components["schemas"]["WebhookEventType"];
            /** Format: uuid */
            documentId: string;
            /** @enum {string} */
            status: "PENDING" | "SENDING" | "SENT" | "FAILED";
            attemptCount: number;
            /** @description Código HTTP de la última respuesta del receptor */
            lastStatus?: number | null;
            lastError?: string | null;
            /** Format: date-time */
            occurredAt: string;
            /** Format: date-time */
            sentAt?: string | null;
            /** Format: date-time */
            nextAttemptAt?: string | null;
        };
        WebhookDeliveryPage: {
            items: components["schemas"]["WebhookDelivery"][];
            page: number;
            size: number;
            /** Format: int64 */
            total: number;
        };
        CreatedWebhookSubscription: {
            /** Format: uuid */
            id: string;
            url: string;
            eventTypes: components["schemas"]["WebhookEventType"][];
            description?: string | null;
            /** @enum {string} */
            status: "ACTIVE" | "DISABLED";
            /** Format: date-time */
            createdAt: string;
            /** @description Secreto de firma (whsec_...). No se vuelve a mostrar. */
            secret: string;
        };
        CreatedInvitation: {
            /** Format: uuid */
            id: string;
            email: string;
            role: components["schemas"]["Role"];
            /** Format: date-time */
            expiresAt: string;
            /** @description Código de la invitación. Solo aparece aquí: el servidor guarda su huella, no el código. Quien invita lo comparte con la persona invitada. */
            token: string;
        };
        InvitationToken: {
            token: string;
        };
        InvitationPreview: {
            tenantName: string;
            role: components["schemas"]["Role"];
            email: string;
            /** Format: date-time */
            expiresAt: string;
        };
        CreateTaxpayerRequest: {
            /** @description RUC del emisor, diez dígitos seguidos de 001 (lo exige el XSD del SRI). */
            ruc: string;
            legalName: string;
            tradeName?: string | null;
            headOfficeAddress: string;
            /**
             * @description Siempre 1 (pruebas): con 2 la petición se rechaza con 422 PRODUCTION_NOT_ENABLED. A producción se pasa con la activación.
             * @enum {string}
             */
            defaultEnvironment: "1" | "2";
            /** @description Obligado a llevar contabilidad. Por defecto false. */
            accountingRequired?: boolean;
            /** @description Código de contribuyente especial, de 3 a 13 caracteres alfanuméricos. */
            specialTaxpayerCode?: string | null;
            /** @description Número de la resolución de agente de retención, sin ceros a la izquierda (hasta 8 dígitos). */
            withholdingAgentCode?: string | null;
            /**
             * @description Régimen RIMPE del emisor. Por defecto NONE. NEGOCIO_POPULAR se rechaza por ahora con 422 RIMPE_REGIME_UNSUPPORTED: el XSD incorporado no admite su leyenda.
             * @enum {string}
             */
            rimpeRegime?: "NONE" | "EMPRENDEDOR" | "NEGOCIO_POPULAR";
        };
        Taxpayer: {
            /** Format: uuid */
            id: string;
            ruc: string;
            legalName: string;
            tradeName?: string | null;
            headOfficeAddress: string;
            /** @enum {string} */
            defaultEnvironment: "1" | "2";
            /**
             * Format: date-time
             * @description Cuándo se activó la emisión en producción; nulo mientras el emisor siga en pruebas.
             */
            productionEnabledAt?: string | null;
            /** @description Obligado a llevar contabilidad. Por defecto false. */
            accountingRequired?: boolean;
            /** @description Código de contribuyente especial, de 3 a 13 caracteres alfanuméricos. */
            specialTaxpayerCode?: string | null;
            /** @description Número de la resolución de agente de retención, sin ceros a la izquierda (hasta 8 dígitos). */
            withholdingAgentCode?: string | null;
            /**
             * @description Régimen RIMPE del emisor. Por defecto NONE. NEGOCIO_POPULAR se rechaza por ahora con 422 RIMPE_REGIME_UNSUPPORTED: el XSD incorporado no admite su leyenda.
             * @enum {string}
             */
            rimpeRegime?: "NONE" | "EMPRENDEDOR" | "NEGOCIO_POPULAR";
        };
        ProductionReadiness: {
            /**
             * Format: date-time
             * @description Hasta cuándo vale el certificado activo; nulo si no hay uno vigente.
             */
            certificateValidUntil?: string | null;
            /** @description Comprobantes del emisor que el SRI autorizó en el ambiente de pruebas. */
            authorizedTestDocuments: number;
            /** @description Si la plataforma transmite hoy al SRI de producción. Es decisión del proveedor, no un requisito del emisor: con false, los comprobantes de producción esperan firmados. */
            transmissionOpen: boolean;
            /**
             * Format: date-time
             * @description Cuándo se activó la producción; nulo si aún no.
             */
            activatedAt?: string | null;
            /** @description Requisitos que el sistema comprueba y aún no se cumplen. */
            missing: ("CERTIFICATE" | "TEST_AUTHORIZATION")[];
        };
        CreateEstablishmentRequest: {
            code: string;
            address: string;
        };
        Establishment: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            taxpayerId: string;
            code: string;
            address: string;
        };
        CreateEmissionPointRequest: {
            /** Format: uuid */
            establishmentId: string;
            code: string;
        };
        EmissionPoint: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            establishmentId: string;
            code: string;
            enabled: boolean;
        };
    };
    responses: {
        /** @description Error en formato RFC 9457. */
        Problem: {
            headers: {
                "X-Correlation-ID": components["headers"]["X-Correlation-ID"];
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description El usuario superó su cupo de peticiones por minuto (errorCode RATE_LIMITED). */
        RateLimited: {
            headers: {
                /** @description Segundos hasta que empiece la siguiente ventana. */
                "Retry-After"?: number;
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
    };
    parameters: {
        /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
        TenantId: string;
    };
    requestBodies: never;
    headers: {
        /** @description Identificador de la petición. Se devuelve en toda respuesta; se respeta el enviado por el cliente si cumple [A-Za-z0-9._-]{1,64}. */
        "X-Correlation-ID": string;
    };
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    listTenants: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Lista de empresas del usuario. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Tenant"][];
                };
            };
            401: components["responses"]["Problem"];
        };
    };
    createTenant: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateTenantRequest"];
            };
        };
        responses: {
            /** @description Empresa creada. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Tenant"];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
        };
    };
    getCurrentTenant: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Empresa activa. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Tenant"];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
        };
    };
    listMembers: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Miembros. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Member"][];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
        };
    };
    changeMemberRole: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path: {
                userId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    role: components["schemas"]["Role"];
                };
            };
        };
        responses: {
            /** @description Miembro con su nuevo rol. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Member"];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            404: components["responses"]["Problem"];
            /** @description errorCode OWNER_PROTECTED, el propietario no cambia de rol. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    removeMember: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path: {
                userId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Retirado. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            404: components["responses"]["Problem"];
            /** @description errorCode OWNER_PROTECTED, el propietario no se retira. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    listInvitations: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Invitaciones pendientes. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Invitation"][];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
        };
    };
    createInvitation: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** Format: email */
                    email: string;
                    role: components["schemas"]["Role"];
                };
            };
        };
        responses: {
            /** @description Invitación creada. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CreatedInvitation"];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            /** @description errorCode ALREADY_MEMBER (esa persona ya es miembro) o INVITATION_LIMIT_REACHED (la empresa tiene 50 invitaciones pendientes). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    revokeInvitation: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Anulada. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            404: components["responses"]["Problem"];
        };
    };
    previewInvitation: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InvitationToken"];
            };
        };
        responses: {
            /** @description Lo que ofrece la invitación. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvitationPreview"];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            404: components["responses"]["Problem"];
        };
    };
    acceptInvitation: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InvitationToken"];
            };
        };
        responses: {
            /** @description Empresa a la que ahora pertenece, con su rol. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Tenant"];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            /** @description errorCode INVITATION_EMAIL_MISMATCH (la invitación es para otro correo, o el token no informa del correo) o EMAIL_NOT_VERIFIED. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description errorCode INVITATION_NOT_VALID: el código no existe, caducó, se anuló o ya se usó. La respuesta no distingue cuál. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description errorCode ALREADY_MEMBER. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    listTaxpayers: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Lista de emisores. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Taxpayer"][];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
        };
    };
    createTaxpayer: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateTaxpayerRequest"];
            };
        };
        responses: {
            /** @description Emisor creado. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Taxpayer"];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            /** @description El RUC ya está registrado en la plataforma (errorCode RUC_ALREADY_REGISTERED). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description errorCode PRODUCTION_NOT_ENABLED: un emisor se da de alta en el ambiente de pruebas y pasa a producción con la activación. O RIMPE_REGIME_UNSUPPORTED. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    getTaxpayer: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Emisor. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Taxpayer"];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            404: components["responses"]["Problem"];
        };
    };
    getProductionReadiness: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Estado de los requisitos. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductionReadiness"];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            404: components["responses"]["Problem"];
        };
    };
    activateProduction: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description El propietario declara que el SRI habilitó este RUC para emitir en producción. */
                    sriProductionAuthorized: boolean;
                };
            };
        };
        responses: {
            /** @description Emisor en producción. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductionReadiness"];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            404: components["responses"]["Problem"];
            /** @description errorCode PRODUCTION_REQUIREMENTS_NOT_MET. `errors` nombra lo que falta: certificate, testAuthorization o sriProductionAuthorized. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    listEstablishments: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path: {
                taxpayerId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Lista de establecimientos. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Establishment"][];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            404: components["responses"]["Problem"];
        };
    };
    createEstablishment: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path: {
                taxpayerId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateEstablishmentRequest"];
            };
        };
        responses: {
            /** @description Establecimiento creado. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Establishment"];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            404: components["responses"]["Problem"];
            /** @description Código ya usado por el emisor (errorCode ESTABLISHMENT_CODE_TAKEN). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    listEmissionPoints: {
        parameters: {
            query: {
                establishmentId: string;
            };
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Lista de puntos de emisión. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmissionPoint"][];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            404: components["responses"]["Problem"];
        };
    };
    createEmissionPoint: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateEmissionPointRequest"];
            };
        };
        responses: {
            /** @description Punto de emisión creado. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmissionPoint"];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            404: components["responses"]["Problem"];
            /** @description Código ya usado en el establecimiento (errorCode EMISSION_POINT_CODE_TAKEN). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    listIdentificationTypes: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Catálogo. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CodeName"][];
                };
            };
            401: components["responses"]["Problem"];
        };
    };
    listPaymentMethods: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Catálogo. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PaymentMethod"][];
                };
            };
            401: components["responses"]["Problem"];
        };
    };
    listTaxRates: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Catálogo. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TaxRate"][];
                };
            };
            401: components["responses"]["Problem"];
        };
    };
    listCustomers: {
        parameters: {
            query?: {
                page?: number;
                size?: number;
                q?: string;
            };
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Página de clientes. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["Customer"][];
                        page: number;
                        size: number;
                        total: number;
                    };
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
        };
    };
    createCustomer: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateCustomerRequest"];
            };
        };
        responses: {
            /** @description Cliente creado. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Customer"];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            409: components["responses"]["Problem"];
            422: components["responses"]["Problem"];
        };
    };
    getCustomer: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Cliente. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Customer"];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            404: components["responses"]["Problem"];
        };
    };
    listProducts: {
        parameters: {
            query?: {
                page?: number;
                size?: number;
                q?: string;
            };
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Página de productos. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["Product"][];
                        page: number;
                        size: number;
                        total: number;
                    };
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
        };
    };
    createProduct: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateProductRequest"];
            };
        };
        responses: {
            /** @description Producto creado. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Product"];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            409: components["responses"]["Problem"];
            422: components["responses"]["Problem"];
        };
    };
    getProduct: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Producto. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Product"];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            404: components["responses"]["Problem"];
        };
    };
    setEmissionPointSequence: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SetSequenceRequest"];
            };
        };
        responses: {
            /** @description Secuencial fijado. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Sequence"];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            404: components["responses"]["Problem"];
            /** @description El contador ya emitió comprobantes (errorCode SEQUENCE_ALREADY_USED). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    issueInvoice: {
        parameters: {
            query?: never;
            header: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
                /** @description Identifica el intento de emisión (hasta 100 caracteres: letras, dígitos y . _ : -). Repetirlo con el mismo cuerpo devuelve el mismo documento; con otro cuerpo responde 409 IDEMPOTENCY_KEY_REUSED. */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["IssueInvoiceRequest"];
            };
        };
        responses: {
            /** @description Factura aceptada y reservada. */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IssuedDocument"];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            404: components["responses"]["Problem"];
            409: components["responses"]["Problem"];
            /** @description Regla fiscal incumplida. errorCode: UNSUPPORTED_CURRENCY, INVALID_ISSUE_DATE, EMISSION_POINT_DISABLED, INVALID_LINE, AMOUNT_TOO_LARGE, TAX_RATE_UNKNOWN, PAYMENT_METHOD_UNKNOWN, INVALID_PAYMENT, PAYMENTS_MISMATCH, FINAL_CONSUMER_LIMIT_EXCEEDED o SEQUENCE_EXHAUSTED. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            429: components["responses"]["RateLimited"];
        };
    };
    listDocuments: {
        parameters: {
            query?: {
                page?: number;
                size?: number;
            };
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Página de comprobantes. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["DocumentSummary"][];
                        page: number;
                        size: number;
                        total: number;
                    };
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
        };
    };
    getDocument: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Comprobante. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Document"];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            404: components["responses"]["Problem"];
        };
    };
    downloadDocumentArtifact: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path: {
                id: string;
                /** @description xml-unsigned y xml-signed son el comprobante; sri-authorization es la respuesta del SRI que lo autorizó, tal como llegó. xml-authorized (el XML autorizado que se entrega al receptor) y ride (su representación impresa, en PDF) existen cuando el comprobante autorizado ya se archivó, poco después de pasar a AUTHORIZED. */
                kind: "xml-unsigned" | "xml-signed" | "sri-authorization" | "xml-authorized" | "ride";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Contenido del artefacto. */
            200: {
                headers: {
                    /** @description SHA-256 del contenido, entre comillas. */
                    ETag?: string;
                    /** @description attachment, con un nombre como factura-001-001-000000123-ride.pdf. */
                    "Content-Disposition"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/xml": string;
                    "application/pdf": string;
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            404: components["responses"]["Problem"];
        };
    };
    listDocumentDeliveries: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Entregas. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Delivery"][];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            404: components["responses"]["Problem"];
        };
    };
    requestDocumentDelivery: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["DeliveryRequest"];
            };
        };
        responses: {
            /** @description Entrega registrada en estado PENDING. */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Delivery"];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            404: components["responses"]["Problem"];
            /** @description No se puede entregar. errorCode: DOCUMENT_NOT_AUTHORIZED (el comprobante no está autorizado), DELIVERY_DISABLED (el envío por correo no está habilitado en la plataforma) o DELIVERY_LIMIT_REACHED (el comprobante ya tiene 10 entregas). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description errorCode DELIVERY_RECIPIENT_MISSING: el comprobante no tiene correo del cliente y no se indicó ninguna dirección. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    retryDocument: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Reintento aceptado; el estado es el que tenía el comprobante. */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DocumentRetryAccepted"];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            404: components["responses"]["Problem"];
            /** @description El comprobante no admite reintento. errorCode: DOCUMENT_NOT_RETRYABLE. Solo se reintenta desde RESERVED, GENERATED, SIGNATURE_FAILED, SIGNED, SENDING o RECEIVED. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    listDocumentSriAttempts: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Intentos ante el SRI. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SriAttempt"][];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            404: components["responses"]["Problem"];
        };
    };
    listCertificates: {
        parameters: {
            query: {
                taxpayerId: string;
            };
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Certificados del emisor. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Certificate"][];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            404: components["responses"]["Problem"];
        };
    };
    uploadCertificate: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UploadCertificateRequest"];
            };
        };
        responses: {
            /** @description Certificado aceptado. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Certificate"];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            404: components["responses"]["Problem"];
            /** @description Certificado no utilizable. errorCode: CERTIFICATE_UNREADABLE (no es PKCS#12 o contraseña incorrecta), CERTIFICATE_NO_PRIVATE_KEY, CERTIFICATE_AMBIGUOUS, CERTIFICATE_KEY_MISMATCH, CERTIFICATE_EXPIRED, CERTIFICATE_NOT_YET_VALID o CERTIFICATE_KEY_UNSUPPORTED. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    listWebhookSubscriptions: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Suscripciones. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WebhookSubscription"][];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
        };
    };
    createWebhookSubscription: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WebhookSubscriptionInput"];
            };
        };
        responses: {
            /** @description Suscripción creada. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CreatedWebhookSubscription"];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            /** @description errorCode WEBHOOKS_DISABLED (la instalación no tiene habilitados los avisos) o WEBHOOK_LIMIT_REACHED (la empresa ya tiene 10 suscripciones). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            422: components["responses"]["Problem"];
        };
    };
    updateWebhookSubscription: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WebhookSubscriptionInput"] & {
                    enabled: boolean;
                };
            };
        };
        responses: {
            /** @description Suscripción actualizada. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WebhookSubscription"];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            404: components["responses"]["Problem"];
            409: components["responses"]["Problem"];
            422: components["responses"]["Problem"];
        };
    };
    deleteWebhookSubscription: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Borrada. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            404: components["responses"]["Problem"];
        };
    };
    listWebhookDeliveries: {
        parameters: {
            query?: {
                page?: number;
                size?: number;
            };
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Página de avisos. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WebhookDeliveryPage"];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            404: components["responses"]["Problem"];
        };
    };
    retryWebhookDelivery: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description El aviso volvió a la cola. */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            404: components["responses"]["Problem"];
            /** @description errorCode WEBHOOK_DELIVERY_NOT_RETRYABLE (el aviso no está fallido), WEBHOOK_SUBSCRIPTION_DISABLED (su suscripción está desactivada) o WEBHOOKS_DISABLED. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    rotateWebhookSecret: {
        parameters: {
            query?: never;
            header?: {
                /** @description Empresa activa. Opcional si el usuario pertenece a una sola; obligatoria si pertenece a varias (400 TENANT_REQUIRED). Una empresa ajena o inexistente responde 403 TENANT_FORBIDDEN. */
                "X-Tenant-Id"?: components["parameters"]["TenantId"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Secreto nuevo. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        secret: string;
                        /** Format: date-time */
                        previousSecretExpiresAt: string;
                    };
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            404: components["responses"]["Problem"];
        };
    };
}
