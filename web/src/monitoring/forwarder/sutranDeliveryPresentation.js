const labels = {
  PENDING: 'Pendiente',
  PROCESSING: 'Procesando',
  DELIVERED: 'Entregado',
  REJECTED: 'Rechazado',
  FAILED: 'Fallido',
};

export const sutranDeliveryPresentation = (delivery) => {
  if (delivery.status === 'FAILED' && delivery.errorMessage === 'SUTRAN_ACKNOWLEDGEMENT_UNKNOWN') {
    return {
      label: 'Resultado incierto; requiere conciliación',
      severity: 'warning',
      error:
        'No se reenviará automáticamente: SUTRAN pudo aceptar la trama antes de la interrupción. Un intento registrado no confirma la recepción remota.',
    };
  }
  const code = Number(delivery.responseCode);
  if (code === 2000 || code === 2001) {
    const complete = delivery.status === 'DELIVERED';
    return {
      label:
        code === 2000
          ? 'Entregado y actualizado'
          : 'Entregado como histórico; no actualizó la posición actual',
      severity: complete ? 'success' : 'warning',
      error: complete
        ? null
        : 'Acuse anómalo o registro previo: verificar CRC y estado HTTP; sin reenvío automático.',
    };
  }
  return {
    label: labels[delivery.status] || delivery.status,
    severity:
      delivery.status === 'DELIVERED'
        ? 'success'
        : ['FAILED', 'REJECTED'].includes(delivery.status)
          ? 'error'
          : 'warning',
    // Historical remote messages can contain sensitive data. Show a controlled diagnostic.
    error:
      delivery.status !== 'DELIVERED' && delivery.errorMessage
        ? 'Error registrado; consulte el código de respuesta y el diagnóstico seguro del servidor.'
        : null,
  };
};
