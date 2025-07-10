package com.appTest.store.repositories;

import com.appTest.store.models.Purchase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface IPurchaseRepository extends JpaRepository <Purchase, Long> {
}
