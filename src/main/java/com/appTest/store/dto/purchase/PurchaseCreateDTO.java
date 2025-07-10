package com.appTest.store.dto.purchase;

import com.appTest.store.dto.purchaseDetail.PurchaseDetailRequestDTO;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.List;

@Getter @Setter
public class PurchaseCreateDTO implements Serializable {
    @NotNull(message = "Date purchase is required")
    private LocalDate datePurchase;

    @NotNull(message = "Materials are required")
    private List<PurchaseDetailRequestDTO> materials;
}
