package com.appTest.store.dto.warehouse;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
@Getter @Setter
public class WarehouseUpdateDTO implements Serializable {

    @NotNull(message = "Warehouse ID is required")
    private Long idWarehouse;

    @Size(min = 2, max = 40, message = "Address must be between 2 and 40 characters")
    private String address;

    @Size(min = 2, max = 40, message = "Name must be between 2 and 40 characters")
    private String name;

    @Size(min = 2, max = 40, message = "Location must be between 2 and 40 characters")
    private String location;
}
