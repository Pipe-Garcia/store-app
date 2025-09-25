package com.appTest.store.services;

import com.appTest.store.dto.saleDetail.SaleDetailRequestDTO;
import com.appTest.store.dto.sale.*;
import com.appTest.store.models.*;
import com.appTest.store.models.enums.ReservationStatus;
import com.appTest.store.repositories.*;
import jakarta.persistence.EntityNotFoundException;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

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
        // Cliente
        Long clientId = (sale.getClient()!=null) ? sale.getClient().getIdClient() : null;
        String clientName = (sale.getClient()!=null)
                ? (sale.getClient().getName() + " " + sale.getClient().getSurname()).trim()
                : "—";

        // Totales
        BigDecimal total = calculateTotal(sale);
        BigDecimal paid  = sale.getPaymentList()==null ? BigDecimal.ZERO :
                sale.getPaymentList().stream()
                        .map(Payment::getAmount)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal balance = total.subtract(paid);
        if (balance.signum() < 0) balance = BigDecimal.ZERO;

        String status = computePaymentStatus(total, paid);

        // (opcional/compat) primer metodo de pago
        String paymentMethod = (sale.getPaymentList()!=null && !sale.getPaymentList().isEmpty())
                ? sale.getPaymentList().get(0).getMethodPayment()
                : null;

        
        Long orderId    = (sale.getOrders()!=null)   ? sale.getOrders().getIdOrders()    : null;

        // Armar DTO
        SaleDTO dto = new SaleDTO();
        dto.setIdSale(sale.getIdSale());
        dto.setClientId(clientId);
        dto.setClientName(clientName);
        dto.setDateSale(sale.getDateSale());
        dto.setTotal(total);
        dto.setPaid(paid);
        dto.setBalance(balance);
        dto.setPaymentStatus(status);
        dto.setPaymentMethod(paymentMethod); // opcional
        dto.setDeliveryId(
                sale.getDelivery() != null ? sale.getDelivery().getIdDelivery() : null
        );
        dto.setOrderId(orderId);
        return dto;
    }


    private BigDecimal calculateTotal(Sale sale) {
        return sale.getSaleDetailList().stream()
                .map(detail -> detail.getQuantity().multiply(detail.getPriceUni()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
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
        if (dto.getMaterials()==null || dto.getMaterials().isEmpty()) {
            throw new IllegalArgumentException("At least one item is required.");
        }

        // --- Cabecera ---
        Sale sale = new Sale();
        sale.setDateSale(dto.getDateSale());

        Client client = repoClient.findById(dto.getClientId())
                .orElseThrow(() -> new EntityNotFoundException("Client not found with ID: " + dto.getClientId()));
        sale.setClient(client);

        // (opcional) vincular entrega antes de persistir, si vino
        if (dto.getDeliveryId() != null) {
            Delivery delivery = repoDelivery.findById(dto.getDeliveryId())
                    .orElseThrow(() -> new EntityNotFoundException("Delivery not found with ID: " + dto.getDeliveryId()));
            // si querés: validar que no esté ya ligada a otra venta
            sale.setDelivery(delivery);
        }

        // ✅ Vincular PEDIDO si vino orderId
        if (dto.getOrderId() != null) {
            Orders order = repoOrders.findById(dto.getOrderId())
                    .orElseThrow(() -> new EntityNotFoundException("Order not found with ID: " + dto.getOrderId()));
            sale.setOrders(order);
        }

        // --- Detalle ---
        List<SaleDetail> saleDetailList = new ArrayList<>();

        for (SaleDetailRequestDTO item : dto.getMaterials()) {
            if (item.getMaterialId()==null || item.getWarehouseId()==null)
                throw new IllegalArgumentException("MaterialId and WarehouseId are required.");
            if (item.getQuantity()==null || item.getQuantity().signum() <= 0)
                throw new IllegalArgumentException("Quantity must be > 0.");

            Material material = repoMat.findById(item.getMaterialId())
                    .orElseThrow(() -> new EntityNotFoundException("Material not found with ID: " + item.getMaterialId()));

            // 1) ALLOCATE (comprometer) reservas del cliente (no descuenta on-hand)
            BigDecimal toSell   = item.getQuantity();
            BigDecimal allocated = reservationService.allocateForSale(
                    dto.getClientId(), item.getMaterialId(), item.getWarehouseId(), toSell, dto.getOrderId()
            );
            BigDecimal remainder = toSell.subtract(allocated); // debería ser 0, salvo que quieras no “forzar” allocation total


            // 2) Si quedó remanente, validar ATP y crear ALLOCATED directo
            if (remainder.signum() > 0) {
                BigDecimal free = servStock.availableForReservation(item.getMaterialId(), item.getWarehouseId());
                if (remainder.compareTo(free) > 0) {
                    throw new IllegalStateException("Not enough free stock (reserved by others).");
                }
                // 3) Crear ALLOCATED directo (venta compromete, no descuenta on-hand)
                reservationService.recordDirectAllocation(
                        dto.getClientId(), item.getMaterialId(), item.getWarehouseId(), remainder, dto.getOrderId()
                );
            }

            // 4) Registrar el detalle (snapshot de precio actual)
            SaleDetail d = new SaleDetail();
            d.setMaterial(material);
            d.setSale(sale);
            d.setQuantity(item.getQuantity());
            d.setPriceUni(material.getPriceArs()!=null ? material.getPriceArs() : BigDecimal.ZERO);

            saleDetailList.add(d);
        }
        sale.setSaleDetailList(saleDetailList);

        // --- Persistir venta ---
        Sale savedSale = repoSale.save(sale);

        // --- Pago inicial (opcional) ---
        if (dto.getPayment() != null) {
            Payment p = new Payment();
            p.setAmount(dto.getPayment().getAmount());
            p.setDatePayment(dto.getPayment().getDatePayment());
            p.setMethodPayment(dto.getPayment().getMethodPayment());
            p.setSale(savedSale);
            repoPayment.save(p);

            // mantener coherente el grafo en memoria para el DTO
            if (savedSale.getPaymentList()==null) savedSale.setPaymentList(new ArrayList<>());
            savedSale.getPaymentList().add(p);
        }

        // --- DTO con total/paid/balance/status consistentes ---
        return convertSaleToDto(savedSale);
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
        if (dto.getDateSale() != null) sale.setDateSale(dto.getDateSale());
        if (dto.getClientId() != null) {
            Client client = repoClient.findById(dto.getClientId())
                    .orElseThrow(() -> new EntityNotFoundException("Client not found"));
            sale.setClient(client);
        }
        repoSale.save(sale);
    }

    @Override
    @Transactional
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
