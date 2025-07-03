package com.appTest.store.dto.family;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
@Getter @Setter
public class FamilyCreateDTO implements Serializable {

    @NotBlank(message = "Type Family cannot be blank")
    @Size(min = 2, max = 50)
    private String typeFamily;

}
