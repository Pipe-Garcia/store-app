package com.appTest.store.dto.family;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
@Getter @Setter
public class FamilyUpdateDTO implements Serializable {

    @NotNull(message = "Family ID is required")
    private Long idFamily;

    @NotNull(message = "Type Family is required")
    @Size(min = 2, max = 50, message = "Type family must be between 2 and 40 characters")
    private String typeFamily;
}
