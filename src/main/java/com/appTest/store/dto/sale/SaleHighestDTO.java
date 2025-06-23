package com.appTest.store.dto.sale;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter @Setter
public class SaleHighestDTO implements Serializable {
    private Long idSale;
    private Double total;
    private int productCount;
    private String clientName;
    private String clientSurname;

    public SaleHighestDTO() {}
    public SaleHighestDTO(String clientName, String clientSurname, Long idSale, int productCount, Double total) {
        this.clientName = clientName;
        this.clientSurname = clientSurname;
        this.idSale = idSale;
        this.productCount = productCount;
        this.total = total;
    }
}

