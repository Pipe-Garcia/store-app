package com.appTest.store.services;

import com.appTest.store.dto.dashboard.DashboardOverviewDTO;
import com.appTest.store.dto.dashboard.Sales30dDTO;
import com.appTest.store.dto.dashboard.StockoutRiskDTO;
import com.appTest.store.dto.dashboard.TopClientDTO;
import com.appTest.store.models.OrderDetail;
import com.appTest.store.models.Orders;
import com.appTest.store.repositories.*;
import jakarta.persistence.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class DashboardService {

  private final ISaleRepository saleRepo;
  private final IDeliveryRepository deliveryRepo;
  private final IOrdersRepository ordersRepo;
  private final IStockReservationRepository reservationRepo;
  private final IStockRepository stockRepo;
  private final IMaterialRepository materialRepo;

  public DashboardService(ISaleRepository saleRepo,
                          IDeliveryRepository deliveryRepo,
                          IOrdersRepository ordersRepo,
                          IStockReservationRepository reservationRepo,
                          IStockRepository stockRepo,
                          IMaterialRepository materialRepo) {
    this.saleRepo = saleRepo;
    this.deliveryRepo = deliveryRepo;
    this.ordersRepo = ordersRepo;
    this.reservationRepo = reservationRepo;
    this.stockRepo = stockRepo;
    this.materialRepo = materialRepo;
  }

  @Transactional(readOnly = true)
  public DashboardOverviewDTO overview() {
    // 1) Cuentas por cobrar
    BigDecimal recvTotal = saleRepo.sumReceivablesTotal();
    Long recvCount = saleRepo.countReceivables();

    // 2) Top clientes (mes actual)
    YearMonth ym = YearMonth.now();
    LocalDate from = ym.atDay(1);
    LocalDate to   = ym.atEndOfMonth();
    List<TopClientDTO> topClients = saleRepo.topClientsBetween(from, to);
    if (topClients.size() > 5) topClients = topClients.subList(0,5);

    // 3) Entregas hoy/mañana (no completadas)
    LocalDate today = LocalDate.now();
    Long dToday = deliveryRepo.countOpenByDate(today);
    Long dTomorrow = deliveryRepo.countOpenByDate(today.plusDays(1));

    // 4) Backlog de pedidos (no convertidos a “sold-out”):
    //    Calculamos en memoria con la misma lógica que usaste para isSoldOut/pending
    List<Orders> all = ordersRepo.findAll();
    long openCount = 0L;
    BigDecimal openValue = BigDecimal.ZERO;
    for (Orders o : all) {
      BigDecimal remainingValue = remainingValueForOrder(o);
      if (remainingValue.compareTo(BigDecimal.ZERO) > 0) {
        openCount++;
        openValue = openValue.add(remainingValue);
      }
    }

    // 5) Stockout risk = materiales donde reservas activas >= stock disponible
    Map<Long, BigDecimal> reserved = toMapBig(reservationRepo.sumActiveByMaterial());
    Map<Long, BigDecimal> available = toMapBig(stockRepo.sumAvailableByMaterial());
    long risk = 0L;
    for (Map.Entry<Long, BigDecimal> e : reserved.entrySet()) {
      BigDecimal avail = available.getOrDefault(e.getKey(), BigDecimal.ZERO);
      if (e.getValue().compareTo(avail) >= 0) risk++;
    }

    return new DashboardOverviewDTO(
      recvTotal != null ? recvTotal : BigDecimal.ZERO,
      recvCount != null ? recvCount : 0L,
      openCount,
      openValue,
      dToday != null ? dToday : 0L,
      dTomorrow != null ? dTomorrow : 0L,
      risk,
      topClients
    );
  }

  public Sales30dDTO salesLast30Days(){
      LocalDate today = LocalDate.now();
      LocalDate curFrom = today.minusDays(29);
      LocalDate curTo   = today;

      LocalDate prevFrom = curFrom.minusDays(30);
      LocalDate prevTo   = curFrom.minusDays(1);

      var cur = saleRepo.sumByDateBetween(curFrom, curTo);
      var prv = saleRepo.sumByDateBetween(prevFrom, prevTo);

      // rellenar faltantes con 0 para cada fecha del rango
      Map<LocalDate, BigDecimal> curMap = new HashMap<>();
      cur.forEach(p -> curMap.put(p.getDate(), p.getTotalAmount()));
      Map<LocalDate, BigDecimal> prvMap = new HashMap<>();
      prv.forEach(p -> prvMap.put(p.getDate(), p.getTotalAmount()));

      List<Sales30dDTO.Point> current = new ArrayList<>();
      List<Sales30dDTO.Point> previous = new ArrayList<>();

      for (int i=29;i>=0;i--){
          LocalDate dCur = today.minusDays(i);
          LocalDate dPrv = prevTo.minusDays(i); // alineado por “posición”
          BigDecimal aCur = curMap.getOrDefault(dCur, BigDecimal.ZERO);
          BigDecimal aPrv = prvMap.getOrDefault(dPrv, BigDecimal.ZERO);
          current.add(new Sales30dDTO.Point(dCur, aCur, 0L));
          previous.add(new Sales30dDTO.Point(dPrv, aPrv, 0L));
      }

      BigDecimal sumC = current.stream().map(Sales30dDTO.Point::amount)
              .reduce(BigDecimal.ZERO, BigDecimal::add);
      BigDecimal sumP = previous.stream().map(Sales30dDTO.Point::amount)
              .reduce(BigDecimal.ZERO, BigDecimal::add);

      BigDecimal deltaPct = BigDecimal.ZERO;
      if (sumP.signum()!=0){
          deltaPct = sumC.subtract(sumP)
                  .divide(sumP, 4, java.math.RoundingMode.HALF_UP)
                  .multiply(new BigDecimal("100"));
      }

      return new Sales30dDTO(current, previous, sumC, sumP, deltaPct);
  }


  @Transactional(readOnly = true)
    public List<StockoutRiskDTO> listStockoutRisk() {
        // 1) available por material
        var availRows = stockRepo.availableByMaterial();
        Map<Long, BigDecimal> available = new HashMap<>();
        for (Object[] r : availRows) {
            Long matId = ((Number) r[0]).longValue();
            BigDecimal qty = (BigDecimal) r[1];
            available.put(matId, qty == null ? BigDecimal.ZERO : qty);
        }

        // 2) reserved (ALLOCATED) por material
        var allocRows = reservationRepo.allocatedByMaterialGlobal();
        Map<Long, BigDecimal> reserved = new HashMap<>();
        for (Object[] r : allocRows) {
            Long matId = ((Number) r[0]).longValue();
            BigDecimal qty = (BigDecimal) r[1];
            reserved.put(matId, qty == null ? BigDecimal.ZERO : qty);
        }

        // 3) materiales en riesgo (reserved >= available)
        Set<Long> atRiskIds = reserved.entrySet().stream()
                .filter(e -> e.getValue().compareTo(available.getOrDefault(e.getKey(), BigDecimal.ZERO)) >= 0)
                .map(Map.Entry::getKey)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        if (atRiskIds.isEmpty()) return List.of();

        // 4) nombres
        var mats = materialRepo.findAllById(atRiskIds);
        Map<Long,String> names = mats.stream().collect(Collectors.toMap(
                m -> m.getIdMaterial(), m -> m.getName(), (a,b)->a));

        // 5) armar lista y ordenar por déficit desc
        List<StockoutRiskDTO> list = new ArrayList<>();
        for (Long id : atRiskIds) {
            BigDecimal a = available.getOrDefault(id, BigDecimal.ZERO);
            BigDecimal r = reserved.getOrDefault(id, BigDecimal.ZERO);
            list.add(new StockoutRiskDTO(id, names.getOrDefault(id, "(sin nombre)"), a, r));
        }
        list.sort(Comparator.comparing(StockoutRiskDTO::getDeficit).reversed());
        return list;
    }

  // ----- helpers -----
  private Map<Long, BigDecimal> toMapBig(List<Object[]> rows){
    Map<Long, BigDecimal> m = new HashMap<>();
    for(Object[] r : rows){
      Long id = ((Number) r[0]).longValue();
      BigDecimal v = (BigDecimal) r[1];
      m.put(id, v!=null? v : BigDecimal.ZERO);
    }
    return m;
  }

  // valor pendiente = sum( pendingUnits(det) * priceUni )
  private BigDecimal remainingValueForOrder(Orders o) {
    // Mapa materialId -> cantidad ALLOCATED (reservas activas/consumidas) para este pedido
    Map<Long, BigDecimal> allocatedByMat = new HashMap<>();
    for (Object[] r : reservationRepo.allocatedByMaterialForOrder(o.getIdOrders())) {
        Long matId = ((Number) r[0]).longValue();
        BigDecimal qty = (BigDecimal) r[1];
        allocatedByMat.put(matId, qty == null ? BigDecimal.ZERO : qty);
    }

    BigDecimal total = BigDecimal.ZERO;
    for (OrderDetail det : o.getOrderDetails()) {
        Long matId = det.getMaterial().getIdMaterial();
        BigDecimal ordered   = det.getQuantity();
        BigDecimal allocated = allocatedByMat.getOrDefault(matId, BigDecimal.ZERO);
        BigDecimal pending   = ordered.subtract(allocated);
        if (pending.signum() > 0) {
        total = total.add( pending.multiply(det.getPriceUni()) );
        }
    }
    return total;
  }

}
