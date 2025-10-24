// src/main/java/com/appTest/store/services/AuditDashService.java
package com.appTest.store.services;

import com.appTest.store.dto.auditdash.*;
import com.appTest.store.models.audit.AuditEvent;
import com.appTest.store.repositories.audit.AuditEventRepository;
import com.appTest.store.repositories.audit.StockMovementRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class AuditDashService {

    private final AuditEventRepository evRepo;
    private final StockMovementRepository smRepo;

    public AuditDashService(AuditEventRepository evRepo, StockMovementRepository smRepo){
        this.evRepo = evRepo; this.smRepo = smRepo;
    }

    public AuditOverviewDTO overview(){
        LocalDate today = LocalDate.now();
        LocalDateTime startToday = today.atStartOfDay();
        LocalDateTime startTomorrow = today.plusDays(1).atStartOfDay();

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime last24h = now.minusHours(24);

        LocalDateTime last7d = now.minusDays(7);

        long eventsToday = evRepo.countBetween(startToday, startTomorrow);
        long succ24 = evRepo.countSuccessBetween(last24h, now);
        long total24 = evRepo.countBetween(last24h, now);
        double successRate24h = (total24 == 0) ? 100.0 : (succ24 * 100.0 / total24);

        long sensitiveCount7d = evRepo.countSensitiveBetween(last7d, now);
        long activeUsers7d = evRepo.countDistinctActorsBetween(last7d, now);

        var lastFailOpt = evRepo.findTopByStatusOrderByTimestampDesc("FAIL");
        AuditOverviewDTO.LastFailureDTO lf = lastFailOpt.map(e ->
                new AuditOverviewDTO.LastFailureDTO(
                        e.getId(), e.getTimestamp(), e.getActorName(),
                        e.getAction(), e.getEntity(), e.getEntityId(), e.getMessage()
                )).orElse(null);

        return new AuditOverviewDTO(eventsToday, successRate24h, sensitiveCount7d, activeUsers7d, lf);
    }

    public AuditSeries30DTO series30d(){
        LocalDate fromDate = LocalDate.now().minusDays(29); // incluye hoy
        LocalDateTime from = fromDate.atStartOfDay();

        // mapa por día
        var rows = evRepo.dailySuccessFailFrom(from);
        Map<LocalDate,long[]> map = new HashMap<>();
        for (Object[] r : rows){
            LocalDate d = (r[0] instanceof java.sql.Date sd) ? sd.toLocalDate() : (LocalDate) r[0];
            long s = ((Number) r[1]).longValue();
            long f = ((Number) r[2]).longValue();
            map.put(d, new long[]{s,f});
        }

        List<LocalDate> labels = new ArrayList<>();
        List<Long> success = new ArrayList<>();
        List<Long> fail    = new ArrayList<>();
        for (int i=0;i<30;i++){
            LocalDate d = fromDate.plusDays(i);
            long[] v = map.getOrDefault(d, new long[]{0,0});
            labels.add(d);
            success.add(v[0]);
            fail.add(v[1]);
        }
        return new AuditSeries30DTO(labels, success, fail);
    }

    public List<CriticalItemDTO> latestCritical(int limit){
        var list = evRepo.latestCritical(PageRequest.of(0, Math.max(1, Math.min(limit, 20))));
        List<CriticalItemDTO> out = new ArrayList<>(list.size());
        for (AuditEvent e : list){
            out.add(new CriticalItemDTO(
                    e.getId(), e.getTimestamp(), e.getActorName(),
                    e.getAction(), e.getEntity(), e.getEntityId(),
                    e.getStatus(), e.getMessage()
            ));
        }
        return out;
    }

    public List<ReasonAggDTO> stockReasonAgg30d(){
        LocalDateTime from = LocalDate.now().minusDays(29).atStartOfDay();
        LocalDateTime to   = LocalDate.now().plusDays(1).atStartOfDay();
        var rows = smRepo.countByReasonBetween(from, to);
        List<ReasonAggDTO> out = new ArrayList<>();
        for (Object[] r : rows){
            out.add(new ReasonAggDTO(Objects.toString(r[0], "UNKNOWN"), ((Number) r[1]).longValue()));
        }
        return out;
    }
}
