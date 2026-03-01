// /static/files-js/registrar-pago.js
const { authFetch, safeJson, getToken } = window.api;
const API_SALES    = '/sales';
const API_PAY      = '/payments';

const $  = (s,r=document)=>r.querySelector(s);
const fmt = new Intl.NumberFormat('es-AR',{ style:'currency', currency:'ARS' });

/* ================== TOASTS (SweetAlert2) ================== */
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer)
    toast.addEventListener('mouseleave', Swal.resumeTimer)
  }
});

function notify(msg, type='info'){
  const icon = ['error','success','warning','info','question'].includes(type) ? type : 'info';
  Toast.fire({ icon: icon, title: msg });
}

let saleId=null, saleTotal=0, salePaid=0, balance=0, sending=false;

function setKPIs(){
  $('#kpiTotal').textContent   = fmt.format(saleTotal||0);
  $('#kpiPaid').textContent    = fmt.format(salePaid||0);
  $('#kpiBalance').textContent = fmt.format(balance||0);
}

function capToBalance(){
  const inp = $('#importe');
  const val = Math.max(0, parseFloat(inp.value || '0'));
  const capped = Math.min(val, balance || val);
  inp.value = (capped>0 ? capped : '').toString();
}

window.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ location.href='../files-html/login.html'; return; }

  const qp = new URLSearchParams(location.search);
  saleId = qp.get('saleId');
  if(!saleId){ notify('Falta saleId','error'); setTimeout(() => location.href='ventas.html', 1500); return; }

  // El botón volver sigue llevando al detalle de la venta por si se arrepiente de pagar
  const goBack = ()=> location.href=`ver-venta.html?id=${saleId}`;
  $('#btnVolver').onclick = goBack;
  $('#btnCancelar').onclick = goBack;

  const d = new Date(); const m=String(d.getMonth()+1).padStart(2,'0'); const dy=String(d.getDate()).padStart(2,'0');
  $('#fecha').value = `${d.getFullYear()}-${m}-${dy}`;
  $('#metodo').value = 'CASH';

  try{
    const r = await authFetch(`${API_SALES}/${saleId}`);
    if(r.ok){
      const s = await safeJson(r);
      saleTotal = Number(s.total ?? s.amount ?? 0);
      salePaid  = Number(s.paid  ?? s.totalPaid ?? 0);
      balance   = Math.max(0, saleTotal - salePaid);

      $('#saleInfo').textContent = `Venta #${s.idSale} — Cliente: ${s.clientName ?? '—'} — Fecha: ${s.dateSale ?? ''}`;
      setKPIs();

      const inp = $('#importe');
      if (balance > 0) { 
        inp.value = balance.toFixed(2); 
        inp.max = String(balance); 
      }
      else { 
        inp.value = ''; 
        inp.placeholder = 'Sin saldo pendiente'; 
        inp.disabled = true;
        $('#btnGuardar').disabled = true; 
        notify('Esta venta ya está pagada por completo.', 'success');
      }
    }
  }catch(e){ console.warn(e); notify('Error al cargar la venta', 'error'); }

  $('#importe').addEventListener('input', capToBalance);
  $('#form-pago').addEventListener('submit', guardarPago);
});

async function guardarPago(ev){
  ev.preventDefault();
  if (sending) return;

  const amount = parseFloat($('#importe').value || '0');
  const datePayment = $('#fecha').value;
  const methodPayment = $('#metodo').value;
  const methodText = $('#metodo').options[$('#metodo').selectedIndex].text;

  if(!(amount>0) || !datePayment || !methodPayment){
    notify('Completá todos los campos con valores válidos','error'); return;
  }
  if (balance && amount > balance + 0.0001){
    notify('El importe no puede superar el saldo','error'); return;
  }

  // 👇 Confirmación con SweetAlert2 antes de enviar
  Swal.fire({
    title: '¿Confirmar pago?',
    html: `Se registrará un pago por <b>${fmt.format(amount)}</b> mediante <b>${methodText}</b>.`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#28a745', // Verde para acciones positivas
    cancelButtonColor: '#d33',
    confirmButtonText: 'Sí, registrar',
    cancelButtonText: 'Cancelar'
  }).then(async (result) => {
    
    // Si el usuario confirma
    if (result.isConfirmed) {
      const payload = { amount, datePayment, methodPayment, saleId: Number(saleId) };

      try{
        sending = true; 
        $('#btnGuardar').disabled = true;
        
        // ✅ CORREGIDO: API_PAY en lugar de API_PAYMENTS
        const res = await authFetch(API_PAY, { method:'POST', body: JSON.stringify(payload) });
        
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        
        // Guardamos flash message para que aparezca al redirigir
        localStorage.setItem('flash', JSON.stringify({ message:'Pago registrado exitosamente', type:'success' }));
        
        // ✅ Redirección a la interfaz de Ventas
        location.href = `ventas.html`;
        
      }catch(e){
        console.error(e);
        notify('No se pudo registrar el pago','error');
        $('#btnGuardar').disabled = false; 
        sending = false;
      }
    }
  });
}