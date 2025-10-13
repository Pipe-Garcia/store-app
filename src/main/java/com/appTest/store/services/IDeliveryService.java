package com.appTest.store.services;

import com.appTest.store.dto.delivery.DeliveryCreateDTO;
import com.appTest.store.dto.delivery.DeliveryDTO;
import com.appTest.store.dto.delivery.DeliveryDetailDTO;
import com.appTest.store.dto.delivery.DeliveryUpdateDTO;
import com.appTest.store.models.Delivery;

import java.util.List;

public interface IDeliveryService {
    List<Delivery> getAllDeliveries();
    Delivery getDeliveryById(Long id);
    DeliveryDTO convertDeliveryToDto(Delivery delivery);
    DeliveryDTO createDelivery(DeliveryCreateDTO dto);
    void updateDelivery(DeliveryUpdateDTO dto);
    void deleteDeliveryById(Long id);

    DeliveryDetailDTO getDeliveryDetail(Long id);
}
