package com.appTest.store.services;

import com.appTest.store.dto.family.*;
import com.appTest.store.models.Family;
import com.appTest.store.repositories.IFamilyRepository;
import jakarta.persistence.EntityNotFoundException;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class FamilyService implements IFamilyService {

    @Autowired
    private IFamilyRepository repoFam;

    @Override
    @Transactional
    public FamilyDTO createFamily(FamilyCreateDTO dto) {
        Family family = new Family();
        family.setTypeFamily(dto.getTypeFamily());
        Family savedFamily = repoFam.save(family);
        return convertFamilyToDto(savedFamily);
    }

    @Override
    @Transactional
    public void updateFamily(FamilyUpdateDTO dto) {
        Family family = repoFam.findById(dto.getIdFamily())
                .orElseThrow(() -> new EntityNotFoundException("Family not found with id: " + dto.getIdFamily()));

        if (dto.getTypeFamily() != null) {
            family.setTypeFamily(dto.getTypeFamily());
        }
        repoFam.save(family);
    }

    @Override
    @Transactional
    public void deleteFamilyById(Long id) {
        repoFam.deleteById(id);
    }

    @Override
    public List<Family> getAllFamilies() {
        return repoFam.findAll();
    }

    @Override
    public Family getFamilyById(Long id) {
        return repoFam.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Family not found with id: " + id));
    }

    @Override
    public FamilyDTO convertFamilyToDto(Family family) {
        return new FamilyDTO(
                family.getIdFamily(),
                family.getTypeFamily()
        );
    }
}

