// src/main/java/com/appTest/store/services/IDeliveryService.java
package com.appTest.store.services;

import com.appTest.store.dto.delivery.DeliveryCreateDTO;
import com.appTest.store.dto.delivery.DeliveryDTO;
import com.appTest.store.dto.delivery.DeliveryDetailDTO;
import com.appTest.store.dto.delivery.DeliveryUpdateDTO;
import com.appTest.store.models.Delivery;
import com.appTest.store.models.enums.DeliveryStatus;

import java.time.LocalDate;
import java.util.List;

public interface IDeliveryService {
    List<Delivery> getAllDeliveries();
    Delivery getDeliveryById(Long id);
    DeliveryDTO convertDeliveryToDto(Delivery delivery);
    DeliveryDTO createDelivery(DeliveryCreateDTO dto);
    void updateDelivery(DeliveryUpdateDTO dto);
    void deleteDeliveryById(Long id);

    DeliveryDetailDTO getDeliveryDetail(Long id);
    List<Delivery> search(DeliveryStatus status, Long orderId, Long clientId, LocalDate from, LocalDate to);

    // ===== NUEVOS =====
    List<DeliveryDTO> getDeliveriesByOrder(Long orderId);
    List<DeliveryDetailDTO> getDeliveryDetailsByOrder(Long orderId);
}
