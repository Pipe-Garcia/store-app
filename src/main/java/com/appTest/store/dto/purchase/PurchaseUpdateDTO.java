package com.appTest.store.dto.purchase;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.time.LocalDate;

@Getter
@Setter
public class PurchaseUpdateDTO implements Serializable {
    @NotNull(message = "Purchase ID is required")
    private Long idPurchase;

    private LocalDate datePurchase;

    private Long supplierId;
}
