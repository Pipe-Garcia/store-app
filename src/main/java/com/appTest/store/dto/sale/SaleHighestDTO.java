package com.appTest.store.dto.sale;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter @Setter
public class SaleHighestDTO implements Serializable {
    private Long idSale;
    private BigDecimal total;
    private int materialCount;
    private String clientName;
    private String clientSurname;

    public SaleHighestDTO() {}
    public SaleHighestDTO(String clientName, String clientSurname, Long idSale, int materialCount, BigDecimal total) {
        this.clientName = clientName;
        this.clientSurname = clientSurname;
        this.idSale = idSale;
        this.materialCount = materialCount;
        this.total = total;
    }
}

