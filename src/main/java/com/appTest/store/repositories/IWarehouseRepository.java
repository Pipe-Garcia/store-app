package com.appTest.store.repositories;

import com.appTest.store.models.Warehouse;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface IWarehouseRepository extends JpaRepository <Warehouse, Long>{
}
