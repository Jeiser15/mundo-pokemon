// Muestra el progreso de la copia local sin bloquear la navegación.
export function iniciarEstadoSnapshot() {
  const indicador = document.querySelector('#estado-snapshot');
  async function actualizar() {
    try {
      const respuesta = await fetch('/api/snapshot');
      if (!respuesta.ok) throw new Error();
      const estado = await respuesta.json();
      if (estado.actualizando) {
        indicador.textContent = estado.total
          ? `Copia local: ${estado.completados} de ${estado.total} recursos`
          : 'Preparando copia local…';
      } else if (estado.error) {
        indicador.textContent = estado.actualizado
          ? 'Copia local anterior disponible · actualización pendiente'
          : 'Copia local pendiente · se reintentará';
      } else if (estado.actualizado) {
        const fecha = new Date(estado.actualizado * 1000);
        indicador.textContent = 'Copia local actualizada: ' + fecha.toLocaleString('es');
      } else {
        indicador.textContent = 'Copia local pendiente';
      }
    } catch {
      indicador.textContent = 'Estado de la copia local no disponible';
    }
  }
  actualizar();
  setInterval(actualizar, 15000);
}
