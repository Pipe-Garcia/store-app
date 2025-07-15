package com.appTest.store.services;

import com.appTest.store.dto.family.*;
import com.appTest.store.models.Family;

import java.util.List;

public interface IFamilyService {
    FamilyDTO createFamily(FamilyCreateDTO dto);
    void updateFamily(FamilyUpdateDTO dto);
    void deleteFamilyById(Long id);
    List<Family> getAllFamilies();
    Family getFamilyById(Long id);
    FamilyDTO convertFamilyToDto(Family family);
}

