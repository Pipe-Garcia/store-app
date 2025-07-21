package com.appTest.store.services;

import com.appTest.store.dto.orderDetail.OrderDetailDTO;
import com.appTest.store.models.OrderDetail;

import java.util.List;

public interface IOrderDetailService {
    List<OrderDetail> getAllOrderDetail();
    OrderDetail getOrderDetailById(Long id);
    OrderDetailDTO convertOrderDetailToDto(OrderDetail orderDetail);
    void deleteOrderDetailById(Long id);
}
