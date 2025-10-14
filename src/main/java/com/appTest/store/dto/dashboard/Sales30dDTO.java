package com.appTest.store.dto.dashboard;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record Sales30dDTO(
    List<Point> current,        // últimos 30 días (incluye hoy)
    List<Point> previous,       // 30 días anteriores
    BigDecimal sumCurrent,
    BigDecimal sumPrevious,
    BigDecimal deltaPct         // (sumCurrent - sumPrevious)/max(1,sumPrevious)*100
){
  public record Point(LocalDate date, BigDecimal amount, Long count){}
}
