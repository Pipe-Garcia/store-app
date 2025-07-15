package com.appTest.store.repositories;

import com.appTest.store.models.Family;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface IFamilyRepository extends JpaRepository <Family, Long>{
}
