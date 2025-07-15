package com.appTest.store.dto.family;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter @Setter
@JsonPropertyOrder({"idFamily", "typeFamily", "quantMaterials"})
public class FamilyDTO implements Serializable {
    private Long idFamily;
    private String typeFamily;
   // private int quantMaterials;

    public FamilyDTO() {}

    public FamilyDTO(Long idFamily, String typeFamily) {
        this.idFamily = idFamily;
        this.typeFamily = typeFamily;
    }
}
