package com.appTest.store.repositories;

import com.appTest.store.models.Stock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface IStockRepository extends JpaRepository <Stock, Long> {
}
