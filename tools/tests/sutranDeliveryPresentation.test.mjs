import test from 'node:test';
import assert from 'node:assert/strict';
import { sutranDeliveryPresentation } from '../../web/src/monitoring/forwarder/sutranDeliveryPresentation.js';

test('interrupted delivery is an uncertain acknowledgement requiring reconciliation', () => {
  const view = sutranDeliveryPresentation({ status: 'FAILED', errorMessage: 'SUTRAN_ACKNOWLEDGEMENT_UNKNOWN' });
  assert.equal(view.severity, 'warning');
  assert.equal(view.label, 'Resultado incierto; requiere conciliación');
  assert.match(view.error, /No se reenviará automáticamente/);
});

test('successful codes have distinct labels and never expose remote OK as an error', () => {
  for (const code of [2000, 2001]) {
    const view = sutranDeliveryPresentation({ status: 'DELIVERED', responseCode: code, errorMessage: 'OK' });
    assert.equal(view.severity, 'success');
    assert.equal(view.error, null);
    assert.equal(view.label, code === 2000 ? 'Entregado y actualizado'
      : 'Entregado como histórico; no actualizó la posición actual');
  }
});

test('legacy and missing CRC acknowledgements are not represented as remote rejection', () => {
  const view = sutranDeliveryPresentation({ status: 'REJECTED', responseCode: 2001, errorMessage: 'OK' });
  assert.equal(view.severity, 'warning');
  assert.match(view.label, /histórico/);
  assert.match(view.error, /CRC/);
});
