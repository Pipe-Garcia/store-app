package com.appTest.store.dto.warehouse;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
@Getter @Setter
public class WarehouseCreateDTO implements Serializable {

    @NotNull(message = "Address is required")
    @Size(min = 2, max = 50)
    private String address;

    @NotNull(message = "Name is required")
    @Size(min = 2, max = 50)
    private String name;

    @NotNull(message = "Location is required")
    @Size(min = 2, max = 50)
    private String location;
}
