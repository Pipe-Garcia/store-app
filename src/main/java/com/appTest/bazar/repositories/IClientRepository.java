package com.appTest.bazar.repositories;

import com.appTest.bazar.models.Client;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface IClientRepository extends JpaRepository <Client, Long> {
}
