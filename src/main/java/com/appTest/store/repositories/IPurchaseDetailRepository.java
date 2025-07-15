package com.appTest.store.repositories;

import com.appTest.store.models.PurchaseDetail;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface IPurchaseDetailRepository extends JpaRepository <PurchaseDetail, Long> {
}
