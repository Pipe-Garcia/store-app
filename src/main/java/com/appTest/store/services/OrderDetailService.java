package com.appTest.store.services;

import com.appTest.store.dto.orderDetail.OrderDetailDTO;
import com.appTest.store.models.OrderDetail;
import com.appTest.store.repositories.IOrderDetailRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
public class OrderDetailService implements IOrderDetailService{

    @Autowired
    private IOrderDetailRepository repoOrderDetail;

    @Override
    public List<OrderDetail> getAllOrderDetail() {
        return repoOrderDetail.findAll();
    }

    @Override
    public OrderDetail getOrderDetailById(Long id) {
        return repoOrderDetail.findById(id).orElseThrow(
                () -> new EntityNotFoundException("Order Detail not found with ID: " + id)
        );
    }

    @Override
    public OrderDetailDTO convertOrderDetailToDto(OrderDetail orderDetail) {
        String materialName = (orderDetail.getMaterial() != null) ? orderDetail.getMaterial().getName() : "Unknown";
        BigDecimal quantityMat = orderDetail.getQuantity();
        BigDecimal priceMat = orderDetail.getPriceUni();
        Long materialId = (orderDetail.getMaterial() !=null ) ? orderDetail.getMaterial().getIdMaterial() : null; // <-- materialId
        return new OrderDetailDTO(
                orderDetail.getIdOrderDetail(),
                orderDetail.getOrders().getIdOrders(),
                materialId,
                materialName,
                priceMat,
                quantityMat
        );
    }

    @Override
    @Transactional
    public void deleteOrderDetailById(Long id) {
        repoOrderDetail.deleteById(id);
    }
}
