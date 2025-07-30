package com.appTest.store.services;

import com.appTest.store.dto.delivery.DeliveryCreateDTO;
import com.appTest.store.dto.delivery.DeliveryDTO;
import com.appTest.store.dto.delivery.DeliveryUpdateDTO;
import com.appTest.store.models.Delivery;
import com.appTest.store.models.OrderDetail;
import com.appTest.store.models.Orders;
import com.appTest.store.models.SaleDetail;
import com.appTest.store.repositories.IDeliveryRepository;
import com.appTest.store.repositories.IOrdersRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
public class DeliveryService implements IDeliveryService{

    @Autowired
    private IDeliveryRepository repoDelivery;

    @Autowired
    private IOrdersRepository repoOrders;

    @Override
    public List<Delivery> getAllDeliveries() {
        return repoDelivery.findAll();
    }

    @Override
    public Delivery getDeliveryById(Long id) {
        return repoDelivery.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Delivery not found with id: " + id));
    }

    @Override
    public DeliveryDTO convertDeliveryToDto(Delivery delivery) {

        String clientName = (delivery.getOrders() != null && delivery.getOrders().getClient() != null)
                ? delivery.getOrders().getClient().getName() : "Name not found";
        String clientSurname = (delivery.getOrders() != null && delivery.getOrders().getClient() != null)
                ? delivery.getOrders().getClient().getSurname() : "Surname not found";
        String completeName = clientName + " " + clientSurname;

        return new DeliveryDTO(
                delivery.getIdDelivery(),
                delivery.getOrders().getIdOrders(),
                delivery.getDeliveryDate(),
                delivery.getStatus(),
                completeName
        );
    }

    private String calculateStatus(Delivery delivery) {
        Orders orders = delivery.getOrders();
        BigDecimal totalOrdered = orders.getOrderDetails().stream()
                .map(OrderDetail::getQuantity)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalDelivered = delivery.getSales().stream()
                .flatMap(sale -> sale.getSaleDetailList().stream())
                .map(SaleDetail::getQuantity)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (totalDelivered.compareTo(BigDecimal.ZERO) == 0) {
            return "PENDING";
        } else if (totalDelivered.compareTo(totalOrdered) < 0) {
            return "PARTIAL";
        } else {
            return "COMPLETED";
        }
    }

    @Override
    @Transactional
    public DeliveryDTO createDelivery(DeliveryCreateDTO dto) {
        Delivery delivery = new Delivery();
        delivery.setDeliveryDate(dto.getDeliveryDate());

        Orders orders = repoOrders.findById(dto.getOrdersId())
                .orElseThrow(() -> new EntityNotFoundException("Orders not found with ID: " + dto.getOrdersId()));
        delivery.setOrders(orders);

        delivery.setStatus(calculateStatus(delivery));

        Delivery savedDelivery = repoDelivery.save(delivery);

        return convertDeliveryToDto(savedDelivery);
    }

    @Override
    @Transactional
    public void updateDelivery(DeliveryUpdateDTO dto) {
        Delivery delivery = repoDelivery.findById(dto.getIdDelivery())
                .orElseThrow(() -> new EntityNotFoundException("Delivery not found with id: " + dto.getIdDelivery()));
        if (dto.getDeliveryDate() != null) delivery.setDeliveryDate(dto.getDeliveryDate());
        if (dto.getStatus() != null) delivery.setStatus(dto.getStatus());
        else delivery.setStatus(calculateStatus(delivery));

        repoDelivery.save(delivery);
    }

    @Override
    @Transactional
    public void deleteDeliveryById(Long id) {
        repoDelivery.deleteById(id);
    }
}
