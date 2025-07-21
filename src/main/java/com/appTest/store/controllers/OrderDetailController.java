package com.appTest.store.controllers;

import com.appTest.store.dto.orderDetail.OrderDetailDTO;
import com.appTest.store.models.OrderDetail;
import com.appTest.store.services.IOrderDetailService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/order-details")
public class OrderDetailController {

    @Autowired
    private IOrderDetailService servOrderDetail;

    @GetMapping
    public ResponseEntity<List<OrderDetailDTO>> getAllOrderDetail() {
        List<OrderDetail> orderDetailList = servOrderDetail.getAllOrderDetail();

        List<OrderDetailDTO> orderDetailDTOList = orderDetailList.stream()
                .map( orderDetail -> servOrderDetail.convertOrderDetailToDto(orderDetail))
                .collect(Collectors.toList());

        return ResponseEntity.ok(orderDetailDTOList);
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrderDetailDTO> getOrderDetailById(@PathVariable Long id) {
        OrderDetail orderDetail = servOrderDetail.getOrderDetailById(id);
        return ResponseEntity.ok(servOrderDetail.convertOrderDetailToDto(orderDetail));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteOrderDetailById(@PathVariable Long id) {
        servOrderDetail.deleteOrderDetailById(id);
        return ResponseEntity.noContent().build();
    }
}
