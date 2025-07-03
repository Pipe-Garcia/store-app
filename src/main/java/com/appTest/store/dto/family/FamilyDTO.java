package com.appTest.store.dto.family;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter @Setter
@JsonPropertyOrder({"typeFamily", "quantMaterials"})
public class FamilyDTO implements Serializable {

    private String typeFamily;
    private int quantMaterials;

    public FamilyDTO() {}

    public FamilyDTO(int quantMaterials, String typeFamily) {
        this.quantMaterials = quantMaterials;
        this.typeFamily = typeFamily;
    }
}
