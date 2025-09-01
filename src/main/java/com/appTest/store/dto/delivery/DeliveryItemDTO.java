package com.appTest.store.dto.delivery;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter; import lombok.Setter;
import java.io.Serializable;
import java.math.BigDecimal;

@Getter @Setter
@JsonPropertyOrder({"idDeliveryItem","orderDetailId","materialId","materialName","warehouseId","warehouseName","quantityOrdered","quantityDelivered","unitPriceSnapshot"})
public class DeliveryItemDTO implements Serializable {
    private Long idDeliveryItem;
    private Long orderDetailId;
    private Long materialId;
    private String materialName;
    private Long warehouseId;
    private String warehouseName;
    private BigDecimal quantityOrdered;     // cantidad pedida (OrderDetail)
    private BigDecimal quantityDelivered;
    private BigDecimal unitPriceSnapshot;

    public DeliveryItemDTO(Long idDeliveryItem, Long orderDetailId, Long materialId,
                               String materialName, Long warehouseId, String warehouseName, BigDecimal quantityOrdered,
                               BigDecimal quantityDelivered, BigDecimal unitPriceSnapshot) {
    
        this.idDeliveryItem = idDeliveryItem;
        this.orderDetailId = orderDetailId;
        this.materialId = materialId;
        this.materialName = materialName;
        this.warehouseId = warehouseId;
        this.warehouseName = warehouseName;
        this.quantityOrdered = quantityOrdered;
        this.quantityDelivered = quantityDelivered;
        this.unitPriceSnapshot = unitPriceSnapshot;
    }

}

