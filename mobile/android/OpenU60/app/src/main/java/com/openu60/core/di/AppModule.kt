package com.openu60.core.di

import android.content.Context
import com.openu60.core.network.AgentClient
import com.openu60.core.network.AuthManager
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideAgentClient(): AgentClient = AgentClient()

    @Provides
    @Singleton
    fun provideAuthManager(
        @ApplicationContext context: Context,
        agentClient: AgentClient,
    ): AuthManager = AuthManager(context, agentClient)
}
