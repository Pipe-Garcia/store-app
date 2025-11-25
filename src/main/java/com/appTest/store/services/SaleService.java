package com.appTest.store.services;

import com.appTest.store.audit.Auditable;
import com.appTest.store.dto.saleDetail.SaleDetailLiteDTO;
import com.appTest.store.dto.saleDetail.SaleDetailRequestDTO;
import com.appTest.store.dto.sale.*;
import com.appTest.store.models.*;
import com.appTest.store.repositories.*;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.appTest.store.models.Delivery;
import com.appTest.store.models.DeliveryItem;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;


import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class SaleService implements ISaleService{

    @Autowired
    private ISaleRepository repoSale;

    @Autowired
    private IClientRepository repoClient;

    @Autowired
    private IMaterialRepository repoMat;

    @Autowired
    private IPaymentRepository repoPayment;

    @Autowired
    private IDeliveryRepository repoDelivery;

    @Autowired
    private IStockService servStock;

    @Autowired
    private IOrdersRepository repoOrders;

    @Autowired
    private IStockReservationService reservationService;

    @Autowired
    private IStockReservationRepository repoReservation;

    @Autowired
    private AuditService audit;

    /* ============ Helpers de auditoría (Sale) ============ */

    private Map<String, Object> snap(Sale sale) {
        if (sale == null) return null;
        Map<String, Object> m = new LinkedHashMap<>();

        // Reutilizamos tu mapper para no repetir lógica
        SaleDTO dto = convertSaleToDto(sale);

        m.put("id", dto.getIdSale());
        m.put("dateSale", dto.getDateSale());
        m.put("clientId", dto.getClientId());
        m.put("clientName", dto.getClientName());
        m.put("total", dto.getTotal());
        m.put("paid", dto.getPaid());
        m.put("balance", dto.getBalance());
        m.put("paymentStatus", dto.getPaymentStatus());
        m.put("totalUnits", dto.getTotalUnits());
        m.put("deliveredUnits", dto.getDeliveredUnits());
        m.put("pendingUnits", dto.getPendingUnits());
        m.put("orderId", dto.getOrderId());
        return m;
    }

    private record Change(String field, Object from, Object to) {}

    private List<Change> diff(Map<String,Object> a, Map<String,Object> b){
        List<Change> out = new ArrayList<>();
        Set<String> keys = new LinkedHashSet<>();
        if (a != null) keys.addAll(a.keySet());
        if (b != null) keys.addAll(b.keySet());
        for (String k : keys){
            Object va = (a != null) ? a.get(k) : null;
            Object vb = (b != null) ? b.get(k) : null;
            if (!Objects.equals(va, vb)){
                out.add(new Change(k, va, vb));
            }
        }
        return out;
    }

    private String humanField(String k){
        return switch (k){
            case "dateSale"       -> "Fecha";
            case "clientId", "clientName" -> "Cliente";
            case "total"          -> "Total";
            case "paid"           -> "Pagado";
            case "balance"        -> "Saldo";
            case "paymentStatus"  -> "Estado pago";
            case "totalUnits"     -> "Unidades vendidas";
            case "deliveredUnits" -> "Unidades entregadas";
            case "pendingUnits"   -> "Unidades pendientes";
            case "orderId"        -> "Presupuesto";
            default -> k;
        };
    }

    private String fmt(Object v){
        if (v == null || (v instanceof String s && s.isBlank())) return "—";
        if (v instanceof BigDecimal bd) return bd.stripTrailingZeros().toPlainString();
        return String.valueOf(v);
    }

    private String summarize(List<Change> changes){
        if (changes == null || changes.isEmpty()) return "OK";
        return changes.stream()
                .limit(3)
                .map(c -> humanField(c.field()) + ": " + fmt(c.from()) + " → " + fmt(c.to()))
                .collect(Collectors.joining(" · "))
                + (changes.size() > 3 ? " +" + (changes.size()-3) + " más" : "");
    }

    private void afterCommit(Runnable r){
        if (TransactionSynchronizationManager.isSynchronizationActive()){
            TransactionSynchronizationManager.registerSynchronization(
                    new TransactionSynchronization() {
                        @Override public void afterCommit() { r.run(); }
                    }
            );
        } else {
            r.run();
        }
    }


    @Override
    public List<Sale> getAllSales() {
        return repoSale.findAll();
    }

    @Override
    public Sale getSaleById(Long idSale) {
        return repoSale.findById(idSale).orElse(null);
    }


    @Override
    public SaleDTO convertSaleToDto(Sale sale) {

        // ===== Cliente =====
        Long clientId = (sale.getClient() != null)
                ? sale.getClient().getIdClient()
                : null;

        String clientName = (sale.getClient() != null)
                ? (sale.getClient().getName() + " " + sale.getClient().getSurname()).trim()
                : "—";

        // ===== Totales monetarios =====
        BigDecimal total = calculateTotal(sale);

        BigDecimal paid = (sale.getPaymentList() == null)
                ? BigDecimal.ZERO
                : sale.getPaymentList().stream()
                .map(p -> p.getAmount() != null ? p.getAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal balance = total.subtract(paid);
        if (balance.signum() < 0) {
            balance = BigDecimal.ZERO;
        }

        String paymentStatus = computePaymentStatus(total, paid);

        // (compat) primer método de pago si existe
        String paymentMethod = (sale.getPaymentList() != null && !sale.getPaymentList().isEmpty())
                ? sale.getPaymentList().get(0).getMethodPayment()
                : null;

        // ===== Unidades vendidas =====
        BigDecimal totalUnits = BigDecimal.ZERO;
        if (sale.getSaleDetailList() != null) {
            totalUnits = sale.getSaleDetailList().stream()
                    .map(sd -> sd.getQuantity() != null ? sd.getQuantity() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
        }

        // ===== Unidades entregadas (todas las entregas de esta venta) =====
        BigDecimal deliveredUnits = BigDecimal.ZERO;
        if (sale.getDeliveries() != null) {
            for (Delivery d : sale.getDeliveries()) {
                if (d.getItems() == null) continue;
                for (DeliveryItem di : d.getItems()) {
                    if (di.getQuantityDelivered() != null) {
                        deliveredUnits = deliveredUnits.add(di.getQuantityDelivered());
                    }
                }
            }
        }

        if (deliveredUnits.compareTo(BigDecimal.ZERO) < 0) {
            deliveredUnits = BigDecimal.ZERO;
        }
        // por seguridad, no sobrepasar las vendidas
        if (totalUnits.compareTo(BigDecimal.ZERO) > 0
                && deliveredUnits.compareTo(totalUnits) > 0) {
            deliveredUnits = totalUnits;
        }

        // ===== Lógica especial: venta directa (mostrador) =====
        boolean isDirectSale =
                (sale.getOrders() == null) &&
                (sale.getDeliveries() == null || sale.getDeliveries().isEmpty());

        if (isDirectSale && totalUnits.compareTo(BigDecimal.ZERO) > 0) {
            // Consideramos que se entregó todo en el momento
            deliveredUnits = totalUnits;
        }

        // ===== Pendientes y estado de entrega =====
        BigDecimal pendingUnits = totalUnits.subtract(deliveredUnits);
        if (pendingUnits.compareTo(BigDecimal.ZERO) < 0) {
            pendingUnits = BigDecimal.ZERO;
        }

        String deliveryStatus;
        if (totalUnits.compareTo(BigDecimal.ZERO) <= 0) {
            deliveryStatus = "NO_ITEMS";
        } else if (isDirectSale) {
            // Venta sin pedido y sin entregas registradas ⇒ venta directa
            deliveryStatus = "DIRECT";
        } else if (deliveredUnits.compareTo(BigDecimal.ZERO) <= 0) {
            deliveryStatus = "PENDING";
        } else if (deliveredUnits.compareTo(totalUnits) < 0) {
            deliveryStatus = "PARTIAL";
        } else {
            deliveryStatus = "COMPLETED";
        }

        // ===== Referencias =====
        Long orderId = (sale.getOrders() != null)
                ? sale.getOrders().getIdOrders()
                : null;

        Long deliveryId = null;
        if (sale.getDeliveries() != null && sale.getDeliveries().size() == 1) {
            deliveryId = sale.getDeliveries().get(0).getIdDelivery();
        }

        // ===== Armar DTO =====
        SaleDTO dto = new SaleDTO();
        dto.setIdSale(sale.getIdSale());
        dto.setClientId(clientId);
        dto.setClientName(clientName);
        dto.setDateSale(sale.getDateSale());
        dto.setTotal(total);
        dto.setPaid(paid);
        dto.setBalance(balance);
        dto.setPaymentStatus(paymentStatus);
        dto.setPaymentMethod(paymentMethod);
        dto.setOrderId(orderId);
        dto.setDeliveryId(deliveryId);

        dto.setTotalUnits(totalUnits);
        dto.setDeliveredUnits(deliveredUnits);
        dto.setPendingUnits(pendingUnits);
        dto.setDeliveryStatus(deliveryStatus);

        return dto;
    }



    @Transactional(readOnly = true)
    public List<SaleDetailLiteDTO> getSaleDetailsLite(Long saleId) {
        Sale sale = repoSale.findById(saleId)
                .orElseThrow(() -> new EntityNotFoundException("Sale not found with ID: " + saleId));

        List<SaleDetailLiteDTO> result = new ArrayList<>();

        // Venta directa: sin pedido y sin entregas asociadas
        boolean isDirectSale =
                (sale.getOrders() == null) &&
                (sale.getDeliveries() == null || sale.getDeliveries().isEmpty());

        // Mapa: materialId -> total entregado en TODAS las entregas de esta venta
        Map<Long, BigDecimal> deliveredByMaterial = new HashMap<>();

        if (sale.getDeliveries() != null) {
            for (Delivery delivery : sale.getDeliveries()) {
                if (delivery.getItems() == null) continue;

                for (DeliveryItem item : delivery.getItems()) {
                    if (item.getMaterial() == null) continue;

                    Long matId = item.getMaterial().getIdMaterial();
                    BigDecimal q = item.getQuantityDelivered() != null
                            ? item.getQuantityDelivered()
                            : BigDecimal.ZERO;

                    deliveredByMaterial.merge(matId, q, BigDecimal::add);
                }
            }
        }

        if (sale.getSaleDetailList() != null) {
            for (SaleDetail sd : sale.getSaleDetailList()) {

                Long matId = sd.getMaterial().getIdMaterial();
                BigDecimal qty = sd.getQuantity() != null ? sd.getQuantity() : BigDecimal.ZERO;

                BigDecimal delivered;
                if (isDirectSale) {
                    // Venta directa: consideramos entregado todo lo vendido
                    delivered = qty;
                } else {
                    delivered = deliveredByMaterial.getOrDefault(matId, BigDecimal.ZERO);
                    if (delivered.compareTo(qty) > 0) {
                        delivered = qty; // cap de seguridad
                    }
                }

                BigDecimal pending = qty.subtract(delivered);
                if (pending.compareTo(BigDecimal.ZERO) < 0) {
                    pending = BigDecimal.ZERO;
                }

                result.add(new SaleDetailLiteDTO(
                        sd.getIdSaleDetail(),
                        matId,
                        sd.getMaterial().getName(),
                        qty,
                        sd.getPriceUni(),
                        delivered,
                        pending
                ));
            }
        }

        return result;
    }


    private BigDecimal calculateTotal(Sale sale) {
        return sale.getSaleDetailList().stream()
                .map(detail -> detail.getQuantity().multiply(detail.getPriceUni()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * Para un pedido dado (orderId), calcula cuántas unidades quedan pendientes por vender
     * por cada material.
     *
     * pendiente(material) = presupuestado(material) - vendidoHastaAhora(material)
     * (nunca devuelve negativos).
     */
    private Map<Long, BigDecimal> calculatePendingByMaterialForOrder(Long orderId) {

        Orders orders = repoOrders.findById(orderId)
                .orElseThrow(() -> new EntityNotFoundException("Order not found with ID: " + orderId));

        // 1) Cantidades PRESUPUESTADAS por material en el pedido
        Map<Long, BigDecimal> orderedByMat = new HashMap<>();
        if (orders.getOrderDetails() != null) {
            for (OrderDetail od : orders.getOrderDetails()) {
                if (od.getMaterial() == null) continue;

                Long matId = od.getMaterial().getIdMaterial();
                BigDecimal qty = Optional.ofNullable(od.getQuantity()).orElse(BigDecimal.ZERO);
                orderedByMat.merge(matId, qty, BigDecimal::add);
            }
        }

        // 2) Cantidades VENDIDAS hasta ahora en todas las ventas ligadas a ese pedido
        Map<Long, BigDecimal> soldByMat = new HashMap<>();
        List<Sale> salesFromOrder = repoSale.findByOrders_IdOrders(orderId);

        for (Sale s : salesFromOrder) {
            if (s.getSaleDetailList() == null) continue;

            for (SaleDetail sd : s.getSaleDetailList()) {
                if (sd.getMaterial() == null) continue;

                Long matId = sd.getMaterial().getIdMaterial();
                BigDecimal qty = Optional.ofNullable(sd.getQuantity()).orElse(BigDecimal.ZERO);
                soldByMat.merge(matId, qty, BigDecimal::add);
            }
        }

        // 3) Pendiente = presupuestado - vendido (cap en 0)
        Map<Long, BigDecimal> pendingByMat = new HashMap<>();
        for (var entry : orderedByMat.entrySet()) {
            Long matId = entry.getKey();
            BigDecimal ordered = Optional.ofNullable(entry.getValue()).orElse(BigDecimal.ZERO);
            BigDecimal sold = Optional.ofNullable(soldByMat.get(matId)).orElse(BigDecimal.ZERO);

            BigDecimal pending = ordered.subtract(sold);
            if (pending.compareTo(BigDecimal.ZERO) < 0) {
                pending = BigDecimal.ZERO;
            }
            pendingByMat.put(matId, pending);
        }

        return pendingByMat;
    }


    @Override
    public SaleSummaryByDateDTO getSaleSummaryByDate(LocalDate date) {
        return repoSale.getSaleSummaryByDate(date);
    }

    @Override
    public SaleHighestDTO getHighestSale() {
        List<SaleHighestDTO> list = repoSale.getHighestSale();
        return list.isEmpty() ? null : list.get(0);
    }

    @Override
    @Transactional
    public SaleDTO createSale(SaleCreateDTO dto) {
        if (dto.getMaterials() == null || dto.getMaterials().isEmpty()) {
            throw new IllegalArgumentException("At least one item is required.");
        }

        // --- Cabecera ---
        Sale sale = new Sale();
        sale.setDateSale(dto.getDateSale());

        Client client = repoClient.findById(dto.getClientId())
                .orElseThrow(() -> new EntityNotFoundException("Client not found with ID: " + dto.getClientId()));
        sale.setClient(client);

        // Vincular pedido como “origen” si viene orderId
        if (dto.getOrderId() != null) {
            Orders order = repoOrders.findById(dto.getOrderId())
                    .orElseThrow(() -> new EntityNotFoundException("Order not found with ID: " + dto.getOrderId()));
            sale.setOrders(order);
        }

        List<SaleDetail> saleDetailList = new ArrayList<>();
        final boolean isOrderSale = (dto.getOrderId() != null);

        Map<Long, BigDecimal> pendingByMaterial = new HashMap<>();
        if (isOrderSale) {
            pendingByMaterial = calculatePendingByMaterialForOrder(dto.getOrderId());

            BigDecimal totalPending = pendingByMaterial.values().stream()
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            // Si el presupuesto ya está totalmente vendido, no dejamos crear más ventas asociadas
            if (totalPending.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalStateException(
                        "Order #" + dto.getOrderId() + " is already fully sold (no pending units)."
                );
            }
        }

        // --- Detalle + lógica de stock ---
        for (SaleDetailRequestDTO item : dto.getMaterials()) {
            if (item.getMaterialId() == null || item.getWarehouseId() == null) {
                throw new IllegalArgumentException("MaterialId and WarehouseId are required.");
            }
            if (item.getQuantity() == null || item.getQuantity().signum() <= 0) {
                throw new IllegalArgumentException("Quantity must be > 0.");
            }

            Long matId       = item.getMaterialId();
            Long warehouseId = item.getWarehouseId();
            BigDecimal qty   = item.getQuantity();

            // === Si la venta viene de un presupuesto, respetar lo pendiente de ese presupuesto ===
            if (isOrderSale) {
                BigDecimal pendingForMat = pendingByMaterial.get(matId);

                // Si el material forma parte del presupuesto, limitamos por lo pendiente
                if (pendingForMat != null) {
                    if (pendingForMat.compareTo(BigDecimal.ZERO) <= 0) {
                        throw new IllegalStateException(
                                "Order #" + dto.getOrderId() +
                                        " has no pending units for material ID " + matId + "."
                        );
                    }
                    if (qty.compareTo(pendingForMat) > 0) {
                        throw new IllegalArgumentException(
                                "Requested quantity " + qty +
                                        " for material ID " + matId +
                                        " exceeds pending units (" + pendingForMat +
                                        ") in order #" + dto.getOrderId() + "."
                        );
                    }
                }
                // Si pendingForMat == null → ese material no estaba en el presupuesto.
                // Permitimos agregarlo igualmente; la regla fuerte es que el pedido no esté en 0 global.
            }

            // Ahora sí buscamos el material
            Material material = repoMat.findById(matId)
                    .orElseThrow(() -> new EntityNotFoundException("Material not found with ID: " + matId));

            // === NUEVO MODELO: SIEMPRE baja stock físico en la venta ===
            BigDecimal onHand = servStock.availability(matId, warehouseId);
            if (qty.compareTo(onHand) > 0) {
                throw new IllegalStateException("Not enough stock on hand.");
            }
            servStock.decreaseStock(matId, warehouseId, qty); // ← único lugar donde baja stock

            // (Opcional) dejar traza en reservas como histórico (no afecta stock)
            try {
                if (isOrderSale) {
                    reservationService.consumeForSale(dto.getClientId(), matId, warehouseId, qty, dto.getOrderId());
                } else {
                    reservationService.recordDirectConsumption(dto.getClientId(), matId, warehouseId, qty, null);
                }
            } catch (Exception ignored) { }

            // Renglón de venta (precio foto)
            SaleDetail d = new SaleDetail();
            d.setMaterial(material);
            d.setSale(sale);
            d.setQuantity(qty);
            d.setPriceUni(material.getPriceArs() != null ? material.getPriceArs() : BigDecimal.ZERO);
            saleDetailList.add(d);
        }

        sale.setSaleDetailList(saleDetailList);

        // Total calculado de la venta (para validar pagos)
        BigDecimal totalAmount = saleDetailList.stream()
                .map(d -> d.getQuantity().multiply(d.getPriceUni()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Validación de pago opcional (igual que antes)
        if (dto.getPayment() != null) {
            var p = dto.getPayment();

            if (p.getAmount() == null || p.getAmount().signum() <= 0
                    || p.getDatePayment() == null
                    || p.getMethodPayment() == null || p.getMethodPayment().isBlank()) {
                throw new IllegalArgumentException(
                        "If 'payment' is sent, amount (> 0), date and method are required."
                );
            }

            if (p.getAmount().compareTo(totalAmount) > 0) {
                throw new IllegalArgumentException("Payment amount cannot exceed sale total.");
            }
        }

        // Persistir venta
        Sale savedSale = repoSale.save(sale);

        // Pago inicial opcional
        if (dto.getPayment() != null) {
            Payment p = new Payment();
            p.setAmount(dto.getPayment().getAmount());
            p.setDatePayment(dto.getPayment().getDatePayment());
            p.setMethodPayment(dto.getPayment().getMethodPayment());
            p.setSale(savedSale);
            repoPayment.save(p);

            if (savedSale.getPaymentList() == null) {
                savedSale.setPaymentList(new ArrayList<>());
            }
            savedSale.getPaymentList().add(p);
        }

        // Por las dudas, recargamos la venta ya completa
        savedSale = repoSale.findById(savedSale.getIdSale())
                .orElseThrow(() -> new EntityNotFoundException("Sale not found after creation"));

        // DTO final
        SaleDTO dtoOut = convertSaleToDto(savedSale);

        // === Auditoría CREATE ===
        final Long sid = dtoOut.getIdSale();
        final Map<String,Object> after = snap(savedSale);

        final String clientName = dtoOut.getClientName() != null ? dtoOut.getClientName() : "—";
        final BigDecimal total = dtoOut.getTotal() != null ? dtoOut.getTotal() : BigDecimal.ZERO;
        final BigDecimal paid  = dtoOut.getPaid()  != null ? dtoOut.getPaid()  : BigDecimal.ZERO;
        final String payStatus = dtoOut.getPaymentStatus();

        StringBuilder msg = new StringBuilder();
        msg.append("Cliente: ").append(clientName)
                .append(" · Total: ").append(fmt(total))
                .append(" · Pagado: ").append(fmt(paid))
                .append(" · Estado pago: ").append(payStatus);
        if (dtoOut.getOrderId() != null) {
            msg.append(" · Presupuesto #").append(dtoOut.getOrderId());
        }
        final String message = msg.toString();

        afterCommit(() -> {
            Long evId = audit.success("CREATE", "Sale", sid, message);
            Map<String,Object> diffPayload = Map.of(
                    "created", true,
                    "fields",  after
            );
            audit.attachDiff(evId, null, after, diffPayload);
        });

        return dtoOut;
    }




    // ADD: helper de consumo

    private String computePaymentStatus(BigDecimal total, BigDecimal paid){
        if (paid == null)  paid  = BigDecimal.ZERO;
        if (total == null) total = BigDecimal.ZERO;

        if (paid.compareTo(BigDecimal.ZERO) <= 0) return "PENDING";
        if (paid.compareTo(total) < 0)          return "PARTIAL";
        return "PAID";
    }



    @Override
    @Transactional
    public void updateSale(SaleUpdateDTO dto) {
        Sale sale = repoSale.findById(dto.getIdSale())
                .orElseThrow(() -> new EntityNotFoundException("Sale not found"));

        Map<String,Object> before = snap(sale);

        if (dto.getDateSale() != null) sale.setDateSale(dto.getDateSale());
        if (dto.getClientId() != null) {
            Client client = repoClient.findById(dto.getClientId())
                    .orElseThrow(() -> new EntityNotFoundException("Client not found"));
            sale.setClient(client);
        }
        repoSale.save(sale);

        Map<String,Object> after = snap(sale);
        List<Change> changes = diff(before, after);
        String message = summarize(changes);
        final Long sid = sale.getIdSale();

        afterCommit(() -> {
            Long evId = audit.success("UPDATE", "Sale", sid, message);
            var changed = changes.stream()
                    .map(c -> Map.<String,Object>of(
                            "field", c.field(),
                            "from",  c.from(),
                            "to",    c.to()
                    ))
                    .collect(Collectors.toList());
            Map<String,Object> diffPayload = Map.of("changed", changed);
            audit.attachDiff(evId, before, after, diffPayload);
        });
    }


    @Override
    @Transactional
    @Auditable(entity="Sale", action="DELETE", idParam="id")
    public void deleteSaleById(Long idSale) {
        repoSale.deleteById(idSale);
    }


    @Override
    @Transactional
    public List<Sale> search(LocalDate from,
                                       LocalDate to,
                                       Long clientId,
                                       String paymentStatus) {
        var list = repoSale.search(from, to, clientId);
        if (paymentStatus == null || paymentStatus.isBlank()) return list;

        final String want = paymentStatus.toUpperCase();
        return list.stream()
                .filter(s -> {
                    var total = calculateTotal(s);
                    var paid  = (s.getPaymentList()==null) ? BigDecimal.ZERO :
                            s.getPaymentList().stream()
                                    .map(Payment::getAmount)
                                    .reduce(BigDecimal.ZERO, BigDecimal::add);
                    return computePaymentStatus(total, paid).equals(want);
                })
                .collect(Collectors.toList());
    }
}
